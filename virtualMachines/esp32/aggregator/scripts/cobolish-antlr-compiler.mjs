import antlr4 from 'antlr4';
import Cobolish85Lexer from '../grammar/generated-modern/Cobolish85Lexer.js';
import Cobolish85Parser from '../grammar/generated-modern/Cobolish85Parser.js';

class CollectingErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, msg) {
    this.errors.push(`line ${line}:${column} ${msg}`);
  }
}

function text(node) {
  return node ? String(node.getText()) : '';
}

function unquote(value) {
  const raw = String(value || '');
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

function extractMatches(sourceText, pattern, mapMatch) {
  const out = [];
  for (const match of String(sourceText || '').matchAll(pattern)) {
    const value = mapMatch(match);
    if (value) out.push(value);
  }
  return out;
}

function collectCobolishMetadata(sourceText) {
  const reservedParagraphNames = new Set([
    'PROGRAM-ID',
    'DISPLAY',
    'GOBACK',
    'MOVE',
    'SET',
    'PERFORM',
    'CALL',
    'IF',
    'EVALUATE',
    'ACCEPT',
    'OPEN',
    'CLOSE',
    'READ',
    'WRITE',
    'START',
    'DELETE',
    'COMPUTE',
    'ADD',
    'SUBTRACT',
    'MULTIPLY',
    'DIVIDE',
    'STRING',
    'STOP',
    'RUN',
    'INTEROP',
    'COPY',
    'EXEC',
    'CONTINUE',
    'END-CALL',
    'END-IF',
    'END-EVALUATE',
    'END-PERFORM',
    'END-EXEC',
    'END-PROGRAM'
  ]);

  const paragraphs = extractMatches(
    sourceText,
    /^\s{0,7}([A-Za-z0-9_-]+)\.(?:\s|$)/gm,
    (match) => {
      const name = String(match?.[1] || '').trim();
      if (!name || /^(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE|WORKING-STORAGE|FILE|CONFIGURATION|INPUT-OUTPUT)$/i.test(name) || reservedParagraphNames.has(name.toUpperCase())) {
        return null;
      }
      return name;
    }
  );

  const interop = extractMatches(
    sourceText,
    /\bINTEROP\s+(WFL|PASCALISH|COBOLISH)\s+"([^"]+)"(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_-]*))?/gi,
    (match) => ({
      kind: String(match?.[1] || '').toUpperCase(),
      target: unquote(match?.[2] || ''),
      alias: String(match?.[3] || '').trim() || null
    })
  );

  const dataItems = extractMatches(
    sourceText,
    /^\s*(?:01|77|88|[0-9]{2})\s+([A-Za-z0-9_-]+)\b/gm,
    (match) => String(match?.[1] || '').trim()
  );

  const programIdMatch = String(sourceText || '').match(/^\s*PROGRAM-ID\.?\s+([A-Za-z0-9_-]+)/im);
  const programId = programIdMatch ? String(programIdMatch[1] || '').trim() : null;

  const divisions = [];
  if (/^\s*IDENTIFICATION\s+DIVISION\.?/im.test(sourceText)) divisions.push('IDENTIFICATION');
  if (/^\s*ENVIRONMENT\s+DIVISION\.?/im.test(sourceText)) divisions.push('ENVIRONMENT');
  if (/^\s*DATA\s+DIVISION\.?/im.test(sourceText)) divisions.push('DATA');
  if (/^\s*PROCEDURE\s+DIVISION\.?/im.test(sourceText)) divisions.push('PROCEDURE');

  return {
    programId,
    paragraphs: Array.from(new Set(paragraphs)),
    interop,
    dataItems: Array.from(new Set(dataItems)),
    divisions,
    lineCount: String(sourceText || '').split(/\r?\n/).length
  };
}

export function parseCobolishWithAntlr(sourceText) {
  const input = new antlr4.InputStream(String(sourceText || ''));
  const lexer = new Cobolish85Lexer(input);
  const lexerErrors = new CollectingErrorListener();
  lexer.removeErrorListeners();
  lexer.addErrorListener(lexerErrors);

  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new Cobolish85Parser(tokens);
  const parserErrors = new CollectingErrorListener();
  parser.removeErrorListeners();
  parser.addErrorListener(parserErrors);
  parser.buildParseTrees = true;

  const tree = parser.compilationUnit();
  const errors = [...lexerErrors.errors, ...parserErrors.errors];

  return {
    tree,
    tokens,
    metadata: collectCobolishMetadata(sourceText),
    errors
  };
}

export function compileCobolishWithAntlr(sourceText, options = {}) {
  const parsed = parseCobolishWithAntlr(sourceText);
  const source = String(sourceText || '');

  return {
    language: 'cobolish',
    version: 1,
    compiledAt: new Date().toISOString(),
    fileName: options.fileName || null,
    sourceHash: source.length,
    programId: parsed.metadata.programId || 'NEW-COBOLISH-PROGRAM',
    sections: parsed.metadata.divisions,
    paragraphs: parsed.metadata.paragraphs,
    dataItems: parsed.metadata.dataItems,
    interop: parsed.metadata.interop,
    lineCount: parsed.metadata.lineCount,
    syntaxErrors: parsed.errors,
    syntaxErrorCount: parsed.errors.length,
    valid: parsed.errors.length === 0,
    parseTree: text(parsed.tree),
    source
  };
}
