/**
 * COBOL PICTURE clauses expressed as Pascalish fixed-point types.
 *
 * `PIC S9(7)V99` describes 7 integer digits and 2 fractional ones, which is exactly
 * `decimal(9, 2)`. The scale is what makes arithmetic COBOL-compatible: the receiving
 * field decides how a result is truncated or rounded.
 */

const PICTURE_TERM = /(S|V|9|X|A|Z|P)(?:\((\d+)\))?/gi;

export function parsePicture(picture) {
  const raw = String(picture || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/^(?:PICTURE|PIC)(?:IS)?/, '');
  if (!raw) return null;

  let signed = false;
  let integerDigits = 0;
  let fractionDigits = 0;
  let seenDecimalPoint = false;
  let alphanumeric = 0;

  PICTURE_TERM.lastIndex = 0;
  let match;
  while ((match = PICTURE_TERM.exec(raw)) !== null) {
    const symbol = match[1];
    const count = match[2] ? Number.parseInt(match[2], 10) : 1;
    if (symbol === 'S') {
      signed = true;
    } else if (symbol === 'V') {
      seenDecimalPoint = true;
    } else if (symbol === '9' || symbol === 'Z' || symbol === 'P') {
      if (seenDecimalPoint) fractionDigits += count;
      else integerDigits += count;
    } else {
      alphanumeric += count;
    }
  }

  // X and A make the item alphanumeric regardless of any digit positions.
  if (alphanumeric > 0) {
    return { kind: 'string', length: alphanumeric, signed: false, pascalishType: 'string' };
  }
  if (integerDigits === 0 && fractionDigits === 0) return null;

  const precision = integerDigits + fractionDigits;
  return {
    kind: 'decimal',
    signed,
    precision,
    scale: fractionDigits,
    pascalishType: `decimal(${precision}, ${fractionDigits})`
  };
}

/** Widest type that can hold both operands without losing digits either side of the point. */
export function widenPictures(a, b) {
  if (!a || a.kind !== 'decimal') return b;
  if (!b || b.kind !== 'decimal') return a;
  const scale = Math.max(a.scale, b.scale);
  const integerDigits = Math.max(a.precision - a.scale, b.precision - b.scale);
  const precision = integerDigits + scale;
  return {
    kind: 'decimal',
    signed: a.signed || b.signed,
    precision,
    scale,
    pascalishType: `decimal(${precision}, ${scale})`
  };
}
