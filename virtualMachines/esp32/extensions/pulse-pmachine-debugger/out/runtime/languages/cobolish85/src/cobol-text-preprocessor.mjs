// COBOL 85 text manipulation (COPY and REPLACE), applied before syntax analysis.
// Text is split into text-words as the standard defines them: literals, separators
// other than spaces (period, parentheses, colon), and runs of other characters.
// Comma and semicolon followed by a space are separators equivalent to a space.

const MAX_COPY_DEPTH = 16;

function tokenize(source) {
  const tokens = [];
  let index = 0;
  const push = (kind, start, end) => tokens.push({ kind, start, end, text: source.slice(start, end) });
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    const start = index;
    if (/\s/.test(char) || ((char === ',' || char === ';') && (next === undefined || /\s/.test(next)))) {
      while (index < source.length && (/\s/.test(source[index])
        || ((source[index] === ',' || source[index] === ';') && (source[index + 1] === undefined || /\s/.test(source[index + 1]))))) index += 1;
      push('space', start, index);
    } else if (char === '*' && next === '>') {
      while (index < source.length && source[index] !== '\n') index += 1;
      push('space', start, index);
    } else if (char === '=' && next === '=') {
      index += 2;
      push('pseudo', start, index);
    } else if (char === '"' || char === "'") {
      index += 1;
      while (index < source.length) {
        if (source[index] === char && source[index + 1] === char) index += 2;
        else if (source[index] === char) { index += 1; break; } else if (source[index] === '\n') break;
        else index += 1;
      }
      push('word', start, index);
    } else if (char === '(' || char === ')' || char === ':' || (char === '.' && (next === undefined || /\s/.test(next)))) {
      index += 1;
      push('word', start, index);
    } else {
      while (index < source.length) {
        const current = source[index];
        const following = source[index + 1];
        if (/\s/.test(current) || current === '"' || current === "'" || current === '(' || current === ')' || current === ':') break;
        if ((current === ',' || current === ';' || current === '.') && (following === undefined || /\s/.test(following))) break;
        if (current === '=' && following === '=') break;
        index += 1;
      }
      push('word', start, index);
    }
  }
  return tokens;
}

const normalize = word => (/^["']/.test(word) ? word : word.toUpperCase());

function wordsOf(text) {
  return tokenize(text).filter(token => token.kind === 'word').map(token => normalize(token.text));
}

// Reads one REPLACING/REPLACE operand starting at token index `at` (spaces skipped).
function readOperand(tokens, at, statement) {
  let index = at;
  while (tokens[index]?.kind === 'space') index += 1;
  const token = tokens[index];
  if (!token) throw new Error(`[COBOL-TEXT] ${statement} operand is missing`);
  if (token.kind === 'pseudo') {
    let end = index + 1;
    while (end < tokens.length && tokens[end].kind !== 'pseudo') end += 1;
    if (end >= tokens.length) throw new Error(`[COBOL-TEXT] ${statement} pseudo-text is not terminated by ==`);
    const inner = tokens.slice(index + 1, end).map(item => item.text).join('');
    return { words: wordsOf(inner), text: inner, next: end + 1 };
  }
  if (token.kind !== 'word' || token.text === '.') throw new Error(`[COBOL-TEXT] ${statement} operand expected at "${token.text}"`);
  return { words: [normalize(token.text)], text: token.text, next: index + 1 };
}

function nextWord(tokens, at) {
  let index = at;
  while (tokens[index]?.kind === 'space') index += 1;
  return { token: tokens[index], index };
}

function readReplacingPairs(tokens, at, statement, stopWords = []) {
  const pairs = [];
  let index = at;
  for (;;) {
    const { token, index: position } = nextWord(tokens, index);
    if (!token) throw new Error(`[COBOL-TEXT] ${statement} is not terminated by a period`);
    if (token.text === '.') return { pairs, next: position + 1 };
    if (stopWords.includes(token.text.toUpperCase())) return { pairs, next: position };
    const from = readOperand(tokens, position, statement);
    if (!from.words.length) throw new Error(`[COBOL-TEXT] ${statement} pseudo-text-1 must contain at least one text-word`);
    const by = nextWord(tokens, from.next);
    if (by.token?.text.toUpperCase() !== 'BY') throw new Error(`[COBOL-TEXT] ${statement} requires BY after each replaced operand`);
    const to = readOperand(tokens, by.index + 1, statement);
    pairs.push({ from: from.words, to: to.text });
    index = to.next;
  }
}

function applyReplacements(source, pairs) {
  if (!pairs.length) return source;
  const tokens = tokenize(source);
  const wordIndexes = tokens.map((token, index) => (token.kind === 'word' ? index : -1)).filter(index => index >= 0);
  let output = '';
  let cursor = 0;
  for (let position = 0; position < wordIndexes.length;) {
    const match = pairs.find(pair => pair.from.every((word, offset) => {
      const token = tokens[wordIndexes[position + offset]];
      return token && normalize(token.text) === word;
    }));
    if (!match) {
      position += 1;
      continue;
    }
    const first = tokens[wordIndexes[position]];
    const last = tokens[wordIndexes[position + match.from.length - 1]];
    output += source.slice(cursor, first.start) + match.to;
    cursor = last.end;
    position += match.from.length;
  }
  return output + source.slice(cursor);
}

function findLibraryText(copybooks, name, library) {
  const wanted = library ? `${library}/${name}` : name;
  const strip = value => value.replace(/^["']|["']$/g, '').toUpperCase();
  for (const [key, value] of Object.entries(copybooks || {})) {
    if (strip(key) === strip(wanted)) return value;
  }
  throw new Error(`[COBOL-TEXT] COPY text ${library ? `${strip(name)} OF ${strip(library)}` : strip(name)} was not supplied`);
}

function expandCopy(source, copybooks, depth) {
  if (depth > MAX_COPY_DEPTH) throw new Error('[COBOL-TEXT] COPY nesting exceeds the supported depth');
  const tokens = tokenize(source);
  let output = '';
  let cursor = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== 'word' || token.text.toUpperCase() !== 'COPY') continue;
    const name = nextWord(tokens, index + 1);
    if (!name.token || name.token.kind !== 'word' || name.token.text === '.') throw new Error('[COBOL-TEXT] COPY requires a text-name');
    let after = nextWord(tokens, name.index + 1);
    let library = null;
    if (after.token && /^(OF|IN)$/i.test(after.token.text)) {
      const libraryToken = nextWord(tokens, after.index + 1);
      if (!libraryToken.token || libraryToken.token.kind !== 'word') throw new Error('[COBOL-TEXT] COPY OF/IN requires a library-name');
      library = libraryToken.token.text;
      after = nextWord(tokens, libraryToken.index + 1);
    }
    let pairs = [];
    let end;
    if (after.token && /^REPLACING$/i.test(after.token.text)) {
      const replacing = readReplacingPairs(tokens, after.index + 1, 'COPY REPLACING');
      if (!replacing.pairs.length) throw new Error('[COBOL-TEXT] COPY REPLACING requires at least one operand pair');
      pairs = replacing.pairs;
      end = replacing.next;
    } else if (after.token?.text === '.') {
      end = after.index + 1;
    } else {
      throw new Error(`[COBOL-TEXT] COPY ${name.token.text} must end with a period`);
    }
    const libraryText = expandCopy(findLibraryText(copybooks, name.token.text, library), copybooks, depth + 1);
    output += source.slice(cursor, token.start) + applyReplacements(libraryText, pairs);
    cursor = tokens[end - 1].end;
    index = end - 1;
  }
  return output + source.slice(cursor);
}


function applyReplaceStatements(source) {
  const tokens = tokenize(source);
  let output = '';
  let cursor = 0;
  let active = [];
  let segmentStart = 0;
  const flush = until => {
    output += applyReplacements(source.slice(segmentStart, until), active);
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== 'word' || token.text.toUpperCase() !== 'REPLACE') continue;
    const following = nextWord(tokens, index + 1);
    if (!following.token || (following.token.kind !== 'pseudo' && following.token.text.toUpperCase() !== 'OFF')) continue;
    flush(token.start);
    if (following.token.text.toUpperCase() === 'OFF') {
      const period = nextWord(tokens, following.index + 1);
      if (period.token?.text !== '.') throw new Error('[COBOL-TEXT] REPLACE OFF must end with a period');
      active = [];
      cursor = period.token.end;
      index = period.index;
    } else {
      const replacing = readReplacingPairs(tokens, following.index, 'REPLACE');
      if (replacing.pairs.some(pair => !pair.from.length)) throw new Error('[COBOL-TEXT] REPLACE pseudo-text-1 must not be empty');
      active = replacing.pairs;
      cursor = tokens[replacing.next - 1].end;
      index = replacing.next - 1;
    }
    segmentStart = cursor;
  }
  flush(source.length);
  return output;
}

/**
 * With DECIMAL-POINT IS COMMA the comma is the decimal point in numeric literals, so
 * `12,5` is rewritten to `12.5` for the lexer. PICTURE character-strings keep their text.
 */
function normalizeDecimalComma(source) {
  if (!/\bDECIMAL-POINT\s+IS\s+COMMA\b/i.test(source)) return source;
  let output = '';
  let cursor = 0;
  const words = tokenize(source).filter(token => token.kind === 'word');
  words.forEach((token, index) => {
    const previous = words.slice(Math.max(0, index - 2), index).map(word => word.text.toUpperCase());
    const isPicture = ['PIC', 'PICTURE'].includes(previous[1]) || (previous[1] === 'IS' && ['PIC', 'PICTURE'].includes(previous[0]));
    if (isPicture || !/^[+-]?\d*,\d+$/.test(token.text)) return;
    output += source.slice(cursor, token.start) + token.text.replace(',', '.');
    cursor = token.end;
  });
  return output + source.slice(cursor);
}

/** Expands COPY statements, applies REPLACE statements (manual chapter 10), then normalizes decimal commas. */
export function preprocessCobolText(source, options = {}) {
  const text = String(source ?? '');
  const expanded = /\b(COPY|REPLACE)\b/i.test(text) ? applyReplaceStatements(expandCopy(text, options.copybooks, 0)) : text;
  return normalizeDecimalComma(expanded);
}
