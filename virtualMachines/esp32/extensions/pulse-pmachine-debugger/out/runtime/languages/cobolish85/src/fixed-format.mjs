export function isFixedCobolFormat(source) {
  const cards = String(source || '').split(/\r\n|\n|\r/)
    .filter(line => line.trim());
  if (!cards.length) return false;
  const sequenceCards = cards.filter(line => /^\d{6}[ *\-/Dd]/.test(line));
  return sequenceCards.length > 0 && sequenceCards.length / cards.length >= 0.5;
}

export function fixedToFree(source, { debug = false } = {}) {
  const lines = [];
  let previousLiteral = null;
  let activeLine = -1;
  for (const card of source.split(/\r\n|\n|\r/)) {
    const indicator = card[6] || ' ';
    if (indicator === '*' || indicator === '/' || ((indicator === 'D' || indicator === 'd') && !debug)) {
      lines.push('');
      continue;
    }
    if (![' ', '-', 'D', 'd'].includes(indicator)) throw new Error(`Invalid fixed-format indicator at card ${lines.length + 1}`);
    let code = card.slice(7, 72).trimEnd();
    if (indicator === '-') {
      code = code.trimStart();
      if (previousLiteral) {
        if (code[0] !== previousLiteral) throw new Error(`Literal continuation lacks opening quote at card ${lines.length + 1}`);
        code = code.slice(1);
      }
      const prior = activeLine;
      if (prior < 0) throw new Error('Continuation without preceding source');
      lines[prior] += code;
      code = '';
    }
    lines.push(code);
    if (code.trim()) activeLine = lines.length - 1;
    const active = lines[activeLine] || '';
    let quote = null;
    for (let i = 0; i < active.length; i++) {
      const character = active[i];
      if (quote && character === quote && active[i + 1] === quote) i++;
      else if (quote === character) quote = null;
      else if (!quote && (character === '"' || character === "'")) quote = character;
    }
    previousLiteral = quote;
  }
  return lines.join('\n');
}
