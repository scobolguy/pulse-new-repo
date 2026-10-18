import { createHash } from 'node:crypto';
export { fixedToFree } from '../src/fixed-format.mjs';

export const CORPUS_SHA256 = '744a04982095a3abea29a9df5faf63d226083edecc7b5bf34bc412eae0d53274';
export const CORPUS_URL = 'https://gnucobol.sourceforge.io/files/newcob.val.tar.gz';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function extractCorpus(text) {
  const units = [];
  let current = null;
  for (const line of text.split(/\r\n|\n|\r/)) {
    const header = line.match(/^\*HEADER,([^,]+),([^, ]+)(?:,([^,]+),([^, ]+))?/);
    if (header) {
      if (current) throw new Error(`Unterminated corpus unit ${current.id}`);
      const [, type, parent, subtype, child] = header;
      const id = child || parent;
      if (!/^[A-Z0-9-]+$/.test(id)) throw new Error(`Unsafe corpus identifier ${id}`);
      current = { id, parent, type, subtype: subtype || null, lines: [] };
    } else if (/^\*END-OF,/.test(line)) {
      if (!current) throw new Error('Unexpected corpus terminator');
      const end = line.match(/^\*END-OF,([^ ,]+)/)?.[1];
      if (end !== current.parent && end !== current.id) throw new Error(`Mismatched corpus terminator ${end}`);
      const source = `${current.lines.join('\n')}\n`;
      const module = current.id === 'EXEC85' ? 'EXEC' : current.parent.slice(0, 2);
      units.push({ ...current, lines: undefined, source, module, sha256: sha256(source),
        role: current.id === 'EXEC85' ? 'harness' : current.type !== 'COBOL' ? 'data'
          : current.subtype ? 'support' : 'program' });
      current = null;
    } else if (current) current.lines.push(line);
  }
  if (current) throw new Error(`Unterminated corpus unit ${current.id}`);
  if (!units.length) throw new Error('No CCVS units found');
  const ids = new Set();
  for (const unit of units) {
    const key = `${unit.type}:${unit.parent}:${unit.id}`;
    if (ids.has(key)) throw new Error(`Duplicate corpus unit ${key}`);
    ids.add(key);
  }
  return units;
}

export function configureSource(source) {
  return source.replace(/\bXXXXX(\d{3})\b/g, (_match, number) => `"data/XXXXX${number}"`);
}

export function evaluateReport(report) {
  if (typeof report !== 'string' || !report.trim()) return { outcome: 'missing_report', diagnostic: 'No CCVS report produced' };
  const totals = {};
  for (const [key, pattern] of Object.entries({
    pass: /(\d+)\s+OF\s+(\d+)\s+TESTS?\s+WERE\s+EXECUTED\s+SUCCESSFULLY/i,
    fail: /(\d+|NO)\s+TESTS?\s+FAILED/i,
    deleted: /(\d+|NO)\s+TESTS?\s+DELETED/i,
    inspect: /(\d+|NO)\s+TESTS?\s+REQUIRE\s+INSPECTION/i
  })) {
    const match = report.match(pattern);
    if (!match) return { outcome: 'malformed_report', diagnostic: `CCVS report lacks ${key} total` };
    totals[key] = match[1].toUpperCase() === 'NO' ? 0 : Number(match[1]);
    if (key === 'pass') totals.total = Number(match[2]);
  }
  if (totals.pass + totals.fail + totals.deleted + totals.inspect !== totals.total) {
    return { outcome: 'malformed_report', diagnostic: 'CCVS report totals do not reconcile', totals };
  }
  return { outcome: totals.fail ? 'test_failure' : totals.inspect ? 'manual_inspection'
    : totals.deleted ? 'deleted_tests' : 'pass', totals, report };
}
