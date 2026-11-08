export function formatCobolDisplay(value, precision, scale, signMode = '', rescaleDecimal) {
  const decimal = rescaleDecimal(value, scale);
  const negative = decimal.unscaled < 0n;
  const digits = (negative ? -decimal.unscaled : decimal.unscaled).toString().padStart(precision, '0');
  if (signMode === 'LEADING_SEPARATE') return `${negative ? '-' : '+'}${digits}`;
  if (signMode === 'TRAILING_SEPARATE') return `${digits}${negative ? '-' : '+'}`;
  return `${negative ? '-' : ''}${digits}`;
}

export function formatCobolEdited(value, rawMask, decimalComma = false, blankWhenZero = false, rescaleDecimal) {
  const mask = String(rawMask || '');
  const decimalAt = mask.lastIndexOf(decimalComma ? ',' : '.');
  const scale = decimalAt < 0 ? 0 : [...mask.slice(decimalAt + 1)].filter(character => '9Z*'.includes(character)).length;
  const integerEnd = decimalAt < 0 ? mask.length : decimalAt;
  const lastRequiredDigit = mask.lastIndexOf('9', integerEnd - 1);
  const floatingSymbols = new Set([...mask.slice(0, integerEnd)].filter(character => '$+-'.includes(character))
    .filter(character => [...mask.slice(0, integerEnd)].filter(candidate => candidate === character).length > 1));
  const integerPositions = [...mask.slice(0, integerEnd)]
    .map((character, index) => '9Z*'.includes(character)
      || (floatingSymbols.has(character) && index < lastRequiredDigit) ? index : -1)
    .filter(index => index >= 0);
  const fractionPositions = decimalAt < 0 ? [] : [...mask.slice(decimalAt + 1)]
    .map((character, index) => '9Z*'.includes(character) ? decimalAt + 1 + index : -1)
    .filter(index => index >= 0);
  const decimal = rescaleDecimal(value, scale);
  const negative = decimal.unscaled < 0n;
  const absolute = (negative ? -decimal.unscaled : decimal.unscaled).toString().padStart(integerPositions.length + scale, '0');
  const integerDigits = absolute.slice(0, absolute.length - scale || undefined).padStart(integerPositions.length, '0');
  const fractionDigits = scale ? absolute.slice(-scale).padStart(scale, '0') : '';
  const isZero = decimal.unscaled === 0n;
  if (blankWhenZero && isZero) return ' '.repeat(mask.length);

  const output = [...mask];
  let significant = false;
  for (let slot = 0; slot < integerPositions.length; slot += 1) {
    const position = integerPositions[slot];
    const digit = integerDigits[slot] || '0';
    const marker = mask[position];
    if (digit !== '0') significant = true;
    output[position] = marker === '9' || significant ? digit : marker === '*' ? '*' : ' ';
  }
  for (let index = 0; index < fractionPositions.length; index += 1) {
    const position = fractionPositions[index];
    const marker = mask[position];
    const digit = fractionDigits[index] || '0';
    output[position] = marker === 'Z' && digit === '0' ? ' ' : marker === '*' && isZero ? '*' : digit;
  }

  const firstDigit = integerPositions.findIndex((_position, index) => integerDigits[index] !== '0');
  const firstPosition = firstDigit < 0 ? integerPositions.at(-1) : integerPositions[firstDigit];
  const currencies = [];
  const signs = [];
  for (let position = 0; position < mask.length; position += 1) {
    if (mask[position] === '$') currencies.push(position);
    if (mask[position] === '+' || mask[position] === '-') signs.push(position);
    if (mask[position] === (decimalComma ? '.' : ',')) {
      const precedingDigits = integerPositions.filter(index => index < position);
      if (precedingDigits.every(index => !/[1-9]/.test(output[index]))) {
        output[position] = ' ';
      }
    }
    if (position === decimalAt && isZero && !mask.includes('*')) output[position] = ' ';
  }
  for (let position = 0; position < mask.length; position += 1) {
    if (mask[position] === 'B') output[position] = ' ';
  }
  for (const positions of [currencies, signs]) {
    const floating = positions.filter(position => position < (firstPosition ?? mask.length));
    if (floating.length) {
      for (const position of floating) output[position] = ' ';
      const selected = floating.at(-1);
      output[selected] = positions === currencies ? '$' : negative ? '-' : ' ';
    }
  }
  for (const marker of ['CR', 'DB']) {
    const position = mask.lastIndexOf(marker);
    if (position >= 0) {
      output[position] = negative ? marker[0] : ' ';
      output[position + 1] = negative ? marker[1] : ' ';
    }
  }
  for (const position of signs) {
    if (position >= (firstPosition ?? mask.length)) {
      output[position] = mask[position] === '+' ? (negative ? '-' : '+') : (negative ? '-' : ' ');
    }
  }
  return output.join('');
}

export function formatReal(value) {
  const text = Math.fround(value).toExponential(6).toUpperCase();
  return text.replace(/E([+-])(\d)$/, 'E$10$2');
}

