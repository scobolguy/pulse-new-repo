// Fixed-form source reader (ANSI X3.9-1978 section 3).
// Produces logical statements with a per-character map back to the original
// line/column so diagnostics and debugger source maps point at real source.

export class FortranError extends SyntaxError {
  constructor(fileName, line, column, message) {
    super(`MNF ${fileName}:${line}:${column}: ${message}`);
    this.fileName = fileName;
    this.line = line;
    this.column = column;
    this.detail = message;
  }
}

const MAX_CONTINUATIONS = 19;

export function readFixedForm(source, { fileName = 'program.ftn' } = {}) {
  const statements = [];
  let continuations = 0;
  for (const [index, raw] of String(source).split(/\r?\n/).entries()) {
    const line = index + 1;
    if (/^[Cc*!]/.test(raw)) continue;
    const card = raw.slice(0, 72);
    if (!card.trim()) continue;
    const tab = card.indexOf('\t');
    if (tab >= 0) throw new FortranError(fileName, line, tab + 1, 'Tabs are not permitted in fixed-form source; use spaces');
    const labelField = card.slice(0, 5);
    const continuation = card.length > 5 && card[5] !== ' ' && card[5] !== '0';
    const text = card.slice(6).padEnd(66, ' ');
    const columns = Array.from({ length: text.length }, (_, offset) => ({ line, column: offset + 7 }));
    if (continuation) {
      if (labelField.trim()) throw new FortranError(fileName, line, 1, 'Continuation requires blank columns 1-5 (no label)');
      if (!statements.length) throw new FortranError(fileName, line, 6, 'Continuation requires a preceding initial line');
      continuations += 1;
      if (continuations > MAX_CONTINUATIONS)
        throw new FortranError(fileName, line, 6, 'A statement may have at most 19 continuation lines');
      const statement = statements.at(-1);
      statement.text += text;
      statement.columns.push(...columns);
      statement.lastLine = line;
      continue;
    }
    continuations = 0;
    const label = labelField.trim();
    if (label && (!/^\d+$/.test(label.replaceAll(' ', '')) || Number(label.replaceAll(' ', '')) === 0))
      throw new FortranError(fileName, line, 1, 'Statement labels in columns 1-5 must be 1 to 99999');
    statements.push({ line, lastLine: line, label: label ? String(Number(label.replaceAll(' ', ''))) : '', text, columns });
  }
  for (const statement of statements) if (!statement.text.trim())
    throw new FortranError(fileName, statement.line, 7, 'Statement text must start in column 7');
  return statements;
}

function canonicalStatement(text, columns) {
  const chars = [], positions = [];
  let quote = null;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      chars.push(character); positions.push(columns[index]);
      if (character === quote) {
        if (text[index + 1] === quote) {
          index++; chars.push(text[index]); positions.push(columns[index]);
        } else quote = null;
      }
    } else if (character === "'" || character === '"') {
      quote = character; chars.push(character); positions.push(columns[index]);
    } else if (character !== ' ') {
      chars.push(character.toUpperCase()); positions.push(columns[index]);
    }
  }
  const compact = chars.join('');
  // FORMAT literals (including Hollerith) retain their original payload.
  if (compact.startsWith('FORMAT(')) {
    const open = positions[6], index = columns.indexOf(open);
    return { text: `FORMAT${text.slice(index)}`, columns: [...positions.slice(0, 6), ...columns.slice(index)] };
  }
  const breaks = new Set();
  const prefix = word => { breaks.add(word.length); };
  let depth = 0, assignment = false;
  quote = null;
  for (let index = 0; index < chars.length; index++) {
    const character = chars[index];
    if (character === "'") {
      if (quote && chars[index + 1] === "'") index++;
      else quote = quote ? null : "'";
    } else if (!quote) {
      if (character === '(') depth++;
      if (character === ')') depth--;
      if (!depth && character === '=') { assignment = true; break; }
    }
  }
  const doMatch = /^DO(\d+),?([A-Z][A-Z0-9]*)=/.exec(compact);
  if (doMatch && compact.slice(doMatch[0].length).includes(',')) {
    breaks.add(2); breaks.add(2 + doMatch[1].length);
  } else if (/^(ELSE)?IF\(/.test(compact)) {
    let nesting = 0, end = -1;
    let quoted = false;
    for (let index = compact.indexOf('('); index < compact.length; index++) {
      if (compact[index] === "'") {
        if (quoted && compact[index + 1] === "'") index++;
        else quoted = !quoted;
        continue;
      }
      if (quoted) continue;
      if (compact[index] === '(') nesting++;
      if (compact[index] === ')' && --nesting === 0) { end = index; break; }
    }
    if (end >= 0 && compact.slice(end + 1) !== 'THEN') {
      const tail = canonicalStatement(compact.slice(end + 1), positions.slice(end + 1));
      return { text: compact.slice(0, end + 1) + tail.text,
        columns: [...positions.slice(0, end + 1), ...tail.columns] };
    }
  } else if (!assignment) {
    const typed = /^(INTEGER|REAL|DOUBLEPRECISION|LOGICAL|COMPLEX|CHARACTER)(\*\d+|\*\(\*\))?FUNCTION/.exec(compact);
    if (typed) { breaks.add(typed[0].length - 8); breaks.add(typed[0].length); }
    else {
      const keyword = /^(PROGRAM|SUBROUTINE|FUNCTION|BLOCKDATA|DOUBLEPRECISION|DIMENSION|EQUIVALENCE|CHARACTER|INTRINSIC|EXTERNAL|PARAMETER|IMPLICIT|INTEGER|COMPLEX|LOGICAL|COMMON|ENDFILE|BACKSPACE|REWIND|RETURN|ENTRY|SAVE|DATA|REAL|STOP|PAUSE|CALL|PRINT|WRITE|READ|OPEN|CLOSE|INQUIRE|GOTO)/.exec(compact);
      if (keyword) prefix(keyword[0]);
      const length = /^(?:CHARACTER|INTEGER|REAL|LOGICAL|COMPLEX)\*\d+/.exec(compact);
      if (length) breaks.add(length[0].length);
      const assign = /^ASSIGN(\d+)TO/.exec(compact);
      if (assign) { breaks.add(6); breaks.add(6 + assign[1].length); breaks.add(assign[0].length); }
    }
  }
  const result = [], mapped = [];
  chars.forEach((character, index) => {
    if (breaks.has(index)) { result.push(' '); mapped.push(positions[index]); }
    result.push(character); mapped.push(positions[index]);
  });
  return { text: result.join(''), columns: mapped };
}

// One synthetic line per logical statement: "label text\n". ANTLR tokens carry
// (synthetic line, column); locate() converts them back to original positions.
export function logicalSource(statements) {
  const lines = [], prefixes = [];
  for (const statement of statements) {
    const canonical = canonicalStatement(statement.text, statement.columns);
    statement.text = canonical.text;
    statement.columns = canonical.columns;
    const prefix = statement.label ? `${statement.label} ` : '';
    prefixes.push(prefix.length);
    lines.push(prefix + statement.text);
  }
  const text = lines.join('\n') + (lines.length ? '\n' : '');
  const locate = (syntheticLine, column) => {
    const statement = statements[syntheticLine - 1];
    if (!statement) {
      const last = statements.at(-1);
      return last ? { line: last.lastLine, column: 73 } : { line: 1, column: 1 };
    }
    const offset = column - prefixes[syntheticLine - 1];
    if (offset < 0) return { line: statement.line, column: 1 };
    const used = statement.text.trimEnd().length;
    const position = offset >= used && used > 0
      ? { ...statement.columns[used - 1], column: statement.columns[used - 1].column + 1 }
      : statement.columns[Math.min(offset, statement.columns.length - 1)];
    return { line: position.line, column: position.column };
  };
  return { text, locate };
}
