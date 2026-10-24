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
    if (!text.trim()) throw new FortranError(fileName, line, 7, 'Statement text must start in column 7');
    statements.push({ line, lastLine: line, label: label ? String(Number(label.replaceAll(' ', ''))) : '', text, columns });
  }
  return statements;
}

// One synthetic line per logical statement: "label text\n". ANTLR tokens carry
// (synthetic line, column); locate() converts them back to original positions.
export function logicalSource(statements) {
  const lines = [], prefixes = [];
  for (const statement of statements) {
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
