import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { getInitialArtifactId, registerArtifactLanguages } from './artifactWorkbench';

const RULE_SNIPPETS = [
  {
    id: 'snippet-conditional',
    label: 'Conditional Expression',
    body: `{
  "expressionType": "conditional",
  "language": "pascalish",
  "expression": "IF amount > 1000 THEN output := 1 ELSE output := 0;"
}`
  },
  {
    id: 'snippet-arithmetic',
    label: 'Arithmetic Expression',
    body: `{
  "expressionType": "arithmetic",
  "language": "pascalish",
  "expression": "output := amount * 1.02;"
}`
  },
  {
    id: 'snippet-string',
    label: 'String Expression',
    body: `{
  "expressionType": "string",
  "language": "pascalish",
  "expression": "output := concat(src, '-', branchCode);"
}`
  },
  {
    id: 'snippet-enum',
    label: 'Enum Block',
    body: `{
  "enums": {
    "priority": ["low", "normal", "high", "urgent"]
  }
}`
  }
];

function flattenLayoutPaths(layouts = []) {
  const paths = [];
  for (const layout of layouts) {
    const typeId = String(layout?.id || layout?.typeId || layout?.name || 'layout');
    const root = layout?.fields || layout?.schema || layout?.properties || [];
    const visit = (node, prefix) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach((entry) => visit(entry, prefix));
        return;
      }
      const nodeName = String(node.name || node.id || node.key || '').trim();
      const nextPrefix = nodeName ? (prefix ? `${prefix}.${nodeName}` : nodeName) : prefix;
      if (nextPrefix) {
        paths.push({
          id: `${typeId}:${nextPrefix}`,
          typeId,
          path: nextPrefix,
          valueType: node.valueType || node.type || 'unknown'
        });
      }
      visit(node.fields, nextPrefix);
      visit(node.children, nextPrefix);
      visit(node.properties, nextPrefix);
      visit(node.items, nextPrefix);
    };
    visit(root, '');
  }
  return paths.slice(0, 400);
}

export default function ArtifactWorkbench({ artifacts = [], cardPreview, messageLayouts = [] }) {
  const [activeArtifactId, setActiveArtifactId] = useState(getInitialArtifactId(cardPreview));
  const [draftById, setDraftById] = useState({});
  const [layoutSearch, setLayoutSearch] = useState('');
  const editorRef = useRef(null);

  const artifactById = useMemo(() => {
    const map = new Map();
    for (const artifact of artifacts) {
      map.set(artifact.id, artifact);
    }
    return map;
  }, [artifacts]);

  const activeArtifact = artifactById.get(activeArtifactId) || artifacts[0] || null;
  const symbols = Array.isArray(activeArtifact?.symbols) ? activeArtifact.symbols : [];
  const activeValue = draftById[activeArtifactId] ?? activeArtifact?.value ?? '';
  const layoutPaths = useMemo(() => flattenLayoutPaths(messageLayouts), [messageLayouts]);
  const filteredLayoutPaths = useMemo(() => {
    const query = String(layoutSearch || '').trim().toLowerCase();
    if (!query) return layoutPaths.slice(0, 80);
    return layoutPaths
      .filter((entry) => entry.path.toLowerCase().includes(query) || entry.typeId.toLowerCase().includes(query))
      .slice(0, 80);
  }, [layoutPaths, layoutSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveArtifactId(getInitialArtifactId(cardPreview));
    }, 0);
    return () => clearTimeout(timer);
  }, [cardPreview]);

  useEffect(() => {
    if (!activeArtifactId && artifacts[0]) {
      const timer = setTimeout(() => {
        setActiveArtifactId(artifacts[0].id);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeArtifactId, artifacts]);

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    registerArtifactLanguages(monaco);
    monaco.editor.setTheme('pulse-artifact-theme');
  };

  const onSelectSymbol = (line) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(Number(line) || 1);
    editor.setPosition({ lineNumber: Number(line) || 1, column: 1 });
    editor.focus();
  };

  const onChangeValue = (nextValue) => {
    if (!activeArtifact) return;
    setDraftById((current) => ({ ...current, [activeArtifact.id]: String(nextValue || '') }));
  };

  const insertAtCursor = (textToInsert) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits('artifact-workbench', [{ range: selection, text: textToInsert, forceMoveMarkers: true }]);
    editor.focus();
  };

  const showRuleTools = ['routing-rule-set', 'routing-rule-template', 'map', 'mapping-rule-template'].includes(activeArtifact?.kind);

  if (!activeArtifact) {
    return <div className="artifact-workbench-empty">No public artifacts available.</div>;
  }

  return (
    <div className="artifact-workbench">
      <div className="artifact-workbench-toolbar">
        <label htmlFor="artifact-workbench-select">Public Artifact</label>
        <select
          id="artifact-workbench-select"
          value={activeArtifact.id}
          onChange={(event) => setActiveArtifactId(event.target.value)}
        >
          {artifacts.map((artifact) => (
            <option key={artifact.id} value={artifact.id}>
              {artifact.name} [{artifact.kind}]
            </option>
          ))}
        </select>
        {showRuleTools ? <span className="artifact-workbench-status">Rule editor enabled</span> : null}
      </div>

      <div className="artifact-workbench-body">
        <div className="artifact-workbench-editor">
          <Editor
            height="520px"
            language={activeArtifact.language || 'plaintext'}
            path={activeArtifact.name || activeArtifact.id}
            value={activeValue}
            onChange={onChangeValue}
            options={{
              readOnly: Boolean(activeArtifact.readOnly),
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              glyphMargin: false,
              folding: true,
              stickyScroll: { enabled: true }
            }}
            onMount={onMount}
          />

          {showRuleTools ? (
            <div className="artifact-workbench-snippets">
              <h4>Rule Snippets</h4>
              <div className="artifact-workbench-chip-row">
                {RULE_SNIPPETS.map((snippet) => (
                  <button key={snippet.id} type="button" onClick={() => insertAtCursor(`${snippet.body}\n`)}>
                    {snippet.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="artifact-workbench-symbols">
          <h4>Symbol Table</h4>
          {symbols.length === 0 ? (
            <p>No symbols found.</p>
          ) : (
            <ul>
              {symbols.map((symbol) => (
                <li key={symbol.id}>
                  <button type="button" onClick={() => onSelectSymbol(symbol.line)}>
                    <span className="artifact-symbol-kind">{symbol.kind}</span>
                    <strong>{symbol.label}</strong>
                    <em>L{symbol.line}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showRuleTools ? (
            <div className="artifact-workbench-layouts">
              <h4>Data Librarian Paths</h4>
              <input
                type="text"
                value={layoutSearch}
                onChange={(event) => setLayoutSearch(event.target.value)}
                placeholder="Search message layout"
              />
              {filteredLayoutPaths.length === 0 ? (
                <p>No paths found.</p>
              ) : (
                <ul>
                  {filteredLayoutPaths.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" onClick={() => insertAtCursor(`"${entry.path}"`)}>
                        <strong>{entry.path}</strong>
                        <em>{entry.typeId}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}