import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  CompletionItemKind,
  TextDocumentSyncKind
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parsePascalishWithAntlr } from '../../scripts/pascalish-antlr-compiler.mjs';
import { PASCALISH_KEYWORDS } from '../../src/documentRegistry.js';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

function parseDiagnostics(text) {
  try {
    parsePascalishWithAntlr(text);
    return [];
  } catch (error) {
    const msg = String(error?.message || error);
    const m = msg.match(/line\s+(\d+):(\d+)/i);
    if (!m) {
      return [
        {
          severity: 1,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 }
          },
          message: msg,
          source: 'pascalish-antlr'
        }
      ];
    }

    const line = Math.max(0, Number(m[1]) - 1);
    const character = Math.max(0, Number(m[2]));
    return [
      {
        severity: 1,
        range: {
          start: { line, character },
          end: { line, character: character + 1 }
        },
        message: msg,
        source: 'pascalish-antlr'
      }
    ];
  }
}

function validateDocument(textDocument) {
  const diagnostics = parseDiagnostics(textDocument.getText());
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [' ', '"']
      }
    }
  };
});

connection.onCompletion(() => {
  return PASCALISH_KEYWORDS.map(keyword => ({
    label: keyword,
    kind: CompletionItemKind.Keyword,
    data: keyword,
    insertText: keyword
  }));
});

documents.onDidOpen(event => validateDocument(event.document));
documents.onDidChangeContent(event => validateDocument(event.document));
documents.onDidSave(event => validateDocument(event.document));

documents.listen(connection);
connection.listen();
