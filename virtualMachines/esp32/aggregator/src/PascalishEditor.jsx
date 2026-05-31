import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { PASCALISH_KEYWORDS } from './documentRegistry';

const DEFAULT_PROGRAM = [
  'SERVICE "librarian-aware-demo";',
  '',
  'VAR myLegacyMessage : LegacyMT103 FROM Librarian;',
  '',
  'ROUTER "mt103-route" INPUT "swift.mt103.inbound" DESCRIPTION "Route MT103" ENABLED TRUE BEGIN',
  '  OUTPUT "swift.mt103.parsed"',
  '    WHEN "output := 1;"',
  '    TRANSFORM "output := src;";',
  'END;'
].join('\n');

let languageInitialized = false;
let completionDisposable = null;

function initializePascalishLanguage(monaco, typeNamesRef) {
  if (!languageInitialized) {
    monaco.languages.register({ id: 'pascalish' });

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
          insertText: 'VAR ${1:myLegacyMessage} : ${2:LegacyMT103} FROM Librarian;',
          detail: 'Librarian-aware variable declaration',
          range,
        },
        {
          label: 'router-skeleton',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          insertText: [
            'ROUTER "${1:route-id}" INPUT "${2:queue.in}" DESCRIPTION "${3:description}" ENABLED TRUE BEGIN',
            '  OUTPUT "${4:queue.out}"',
            '    WHEN "output := 1;"',
            '    TRANSFORM "output := src;";',
            'END;'
          ].join('\n'),
          detail: 'Router definition skeleton',
          range,
        }
      ];

      return {
        suggestions: [...snippetItems, ...typeItems, ...keywordItems]
      };
    }
  });
}

export { initializePascalishLanguage };

export default function PascalishEditor() {
  const [source, setSource] = useState(DEFAULT_PROGRAM);
  const [types, setTypes] = useState([]);
  const [status, setStatus] = useState('Loading Librarian types...');
  const typeNamesRef = useRef([]);

  const typeNames = useMemo(() => {
    return (types || [])
      .map((item) => String(item?.id || item?.name || item?.typeName || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [types]);

  useEffect(() => {
    typeNamesRef.current = typeNames;
  }, [typeNames]);

  useEffect(() => {
    let cancelled = false;

    async function loadTypes() {
      try {
        const response = await fetch('/api/librarian/data-types');
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setStatus(`Failed to load types (${response.status}).`);
          return;
        }

        const nextTypes = Array.isArray(payload.types) ? payload.types : [];
        setTypes(nextTypes);
        setStatus(`Loaded ${nextTypes.length} Librarian data types.`);
      } catch (error) {
        if (!cancelled) {
          setStatus(`Type load failed: ${error.message}`);
        }
      }
    }

    loadTypes();
    const timer = setInterval(loadTypes, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Pascalish Editor</h3>
        <span style={{ fontSize: 12, opacity: 0.85 }}>{status}</span>
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        Tip: Type declarations can autocomplete Librarian types, for example: VAR myLegacyMessage : LegacyMT103 FROM Librarian;
      </div>

      <div style={{ flex: 1, minHeight: 540, border: '1px solid rgba(148, 163, 184, 0.35)', borderRadius: 8, overflow: 'hidden' }}>
        <Editor
          height="100%"
          language="pascalish"
          theme="pascalishWorkbench"
          value={source}
          onChange={(value) => setSource(value || '')}
          beforeMount={(monaco) => initializePascalishLanguage(monaco, typeNamesRef)}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            wordWrap: 'on',
            smoothScrolling: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            formatOnType: false,
          }}
        />
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Available types: {typeNames.length === 0 ? 'none loaded' : typeNames.slice(0, 12).join(', ')}{typeNames.length > 12 ? ' ...' : ''}
      </div>
    </div>
  );
}
