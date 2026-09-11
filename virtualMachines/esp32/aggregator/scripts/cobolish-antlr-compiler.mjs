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
  const role = String(sourceText || '').match(/\bROLE\s+(CODE_LIBRARIAN|[A-Za-z_][A-Za-z0-9_-]*)\s*\.?/i)?.[1] || null;
  const libraries = Array.from(String(sourceText || '').matchAll(/\bLIBRARY\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+FROM\s+(?:LIBRARIAN|"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))/gi), (match) => ({
    id: String(match[1] || match[2] || match[3] || '').trim(),
    source: String(match[4] || match[5] || match[6] || 'librarian').trim() || 'librarian'
  })).filter(item => item.id);
  const uses = Array.from(String(sourceText || '').matchAll(/\bUSE\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_-]*))?\s*\.?/gi), (match) => ({
    id: String(match[1] || match[2] || match[3] || '').trim(),
    alias: String(match[4] || '').trim() || null
  })).filter(item => item.id);
  const mapperImports = Array.from(String(sourceText || '').matchAll(/\bIMPORT\s+MAPPER\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+FROM\s+(?:MAPPER|LIBRARIAN|"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))/gi), (match) => ({
    id: String(match[1] || match[2] || match[3] || '').trim()
  })).filter(item => item.id);
  const routes = Array.from(String(sourceText || '').matchAll(/\bROUTE\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+TO\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+USING\s+MAPPER\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s*\.?/gi), (match) => ({
    fromQueue: String(match[1] || match[2] || match[3] || '').trim(),
    toQueue: String(match[4] || match[5] || match[6] || '').trim(),
    mapperId: String(match[7] || match[8] || match[9] || '').trim()
  })).filter(item => item.fromQueue && item.toQueue && item.mapperId);
  const serviceCalls = Array.from(String(sourceText || '').matchAll(/\bSEND\s+SERVICE\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+USING\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\.?/gi), (match) => ({
    serviceId: String(match[1] || match[2] || match[3] || '').trim(),
    input: String(match[4] || 'SRC').trim()
  })).filter(item => item.serviceId);

  // Extract inline MAPPING SECTION mapper definitions.
  // MAPPER-ENTRY <id> SOURCE-TYPE <s> TARGET-TYPE <t>. MAP-RULE <src> TO <tgt> USING <body>.
  const mappers = [];
  const mapperEntryRe = /\bMAPPER-ENTRY\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+SOURCE-TYPE\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s+TARGET-TYPE\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_-]*))\s*\.?/gi;
  const mapRuleRe = /\bMAP-RULE\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z0-9_@#][A-Za-z0-9_@#.-]*)\s+TO\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z0-9_@#][A-Za-z0-9_@#.-]*)\s+USING\s+(BEGIN\b[\s\S]*?\bEND|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\.?/gi;

  const entryMatches = Array.from(String(sourceText || '').matchAll(mapperEntryRe));
  const ruleMatches = Array.from(String(sourceText || '').matchAll(mapRuleRe));

  const unquoteTok = (tok) => {
    const s = String(tok || '').trim();
    if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) return s.slice(1, -1);
    return s;
  };

  for (let i = 0; i < entryMatches.length; i += 1) {
    const em = entryMatches[i];
    const id = unquoteTok(em[1] || em[2] || em[3]);
    const sourceTypeId = unquoteTok(em[4] || em[5] || em[6]);
    const targetTypeId = unquoteTok(em[7] || em[8] || em[9]);
    const entryStart = em.index + em[0].length;
    const entryEnd = i + 1 < entryMatches.length ? entryMatches[i + 1].index : String(sourceText).length;

    const items = [];
    for (const rm of ruleMatches) {
      if (rm.index < entryStart || rm.index >= entryEnd) continue;
      const sourcePath = unquoteTok(rm[1]);
      const targetPath = unquoteTok(rm[2]);
      let ruleBody = String(rm[3] || '').trim();
      // Normalize BEGIN...END body to a bare expression string for the compiler.
      if (/^BEGIN\b/i.test(ruleBody)) ruleBody = ruleBody.replace(/^BEGIN\b/i, '').replace(/\bEND\s*$/, '').trim();
      else ruleBody = unquoteTok(ruleBody);
      items.push({ sourcePath, targetPath, conversionRule: ruleBody });
    }
    mappers.push({ id, sourceTypeId, targetTypeId, items });
  }

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

  const displayStatements = extractMatches(
    sourceText,
    /\bDISPLAY\s+"((?:[^"\\]|\\.)*)"\s*\./gi,
    (match) => String(match?.[1] || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  );
  const displayVariables = extractMatches(
    sourceText,
    /\bDISPLAY\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\./gi,
    (match) => String(match?.[1] || '').trim()
  );
  const assignments = extractMatches(
    sourceText,
    /\bMOVE\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[-+]?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_-]*)\s+TO\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\.?/gi,
    (match) => ({ value: String(match?.[1] || '').trim(), target: String(match?.[2] || '').trim() })
  );
  const receiveVariables = extractMatches(
    sourceText,
    /\bACCEPT\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\./gi,
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
    role,
    libraries,
    uses,
    mapperImports,
    routes,
    serviceCalls,
    mappers,
    paragraphs: Array.from(new Set(paragraphs)),
    interop,
    dataItems: Array.from(new Set(dataItems)),
    displayStatements,
    displayVariables,
    assignments,
    receiveVariables,
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
    displayStatements: parsed.metadata.displayStatements,
    displayVariables: parsed.metadata.displayVariables,
    assignments: parsed.metadata.assignments,
    receiveVariables: parsed.metadata.receiveVariables,
    role: parsed.metadata.role,
    libraries: parsed.metadata.libraries,
    uses: parsed.metadata.uses,
    mapperImports: parsed.metadata.mapperImports,
    routes: parsed.metadata.routes,
    serviceCalls: parsed.metadata.serviceCalls,
    mappers: parsed.metadata.mappers,
    interop: parsed.metadata.interop,
    lineCount: parsed.metadata.lineCount,
    syntaxErrors: parsed.errors,
    syntaxErrorCount: parsed.errors.length,
    valid: parsed.errors.length === 0,
    parseTree: text(parsed.tree),
    source
  };
}
