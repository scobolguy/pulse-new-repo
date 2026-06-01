import { PASCALISH_KEYWORDS } from './documentRegistry';

let languageInitialized = false;
let completionDisposable = null;

export function initializePascalishLanguage(monaco, typeNamesRef) {
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
