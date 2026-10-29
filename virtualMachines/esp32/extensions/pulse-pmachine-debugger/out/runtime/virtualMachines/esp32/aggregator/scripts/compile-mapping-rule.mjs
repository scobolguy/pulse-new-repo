// Compile a single conversion rule body (e.g. "output = yymmddtoiso(src)" or
// the legacy "output := trim(src);") into a flat, stack-based opcode list that
// the PMachine executes natively. This removes all runtime string parsing of
// conversion rules: SRC pushes the source value, native ops transform it, and
// the top of stack is the mapped result. Unknown/empty rules degrade to a
// pass-through (SRC) so a bare "output = src" still works.
export function compileConversionRuleToOps(ruleText) {
  const raw = String(ruleText || '').trim();
  if (!raw) return ['SRC'];

  // Strip BEGIN/END delimiters, "output :="/"output =", and trailing ';'.
  let expr = raw
    .replace(/^begin\b/i, '')
    .replace(/\bend\b[.;]?\s*$/i, '')
    .replace(/^output\s*(:=|=)\s*/i, '')
    .replace(/;+\s*$/, '')
    .trim();

  const upper = expr.toUpperCase().replace(/\s+/g, '');

  // Pass-through.
  if (upper === 'SRC' || upper === 'OUTPUT=SRC' || upper === 'OUTPUT:=SRC') return ['SRC'];

  // Literal string.
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return [`PUSH_STR ${expr}`];
  }

  // Helper name -> native opcode.
  const NATIVE = [
    ['UPPER', 'UPPER'],
    ['TRIM', 'TRIM'],
    ['YYMMDDTOISO', 'YYMMDD_TO_ISO'],
    ['MTAMOUNTTODECIMAL', 'MT_AMOUNT_TO_DECIMAL'],
    ['MTPARTYNAME', 'MT_PARTY_NAME'],
    ['MTCHARGEBEARERTOISO', 'MT_CHARGE_TO_ISO']
  ];

  // Parse a (possibly nested) call like UPPER(TRIM(SRC)) into [SRC, TRIM, UPPER].
  const ops = [];
  let rest = upper;
  const callStack = [];
  while (true) {
    const m = rest.match(/^([A-Z_]+)\((.*)\)$/);
    if (!m) break;
    const fn = m[1];
    const op = NATIVE.find(([name]) => name === fn)?.[1];
    if (op) callStack.push(op);
    rest = m[2].trim();
  }
  // Innermost term should be SRC or a literal.
  if (rest === 'SRC' || rest === '') {
    ops.push('SRC');
  } else if ((rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'"))) {
    ops.push(`PUSH_STR ${rest}`);
  } else {
    ops.push('SRC');
  }
  // callStack currently holds outermost-first; reverse so inner runs first.
  for (let i = callStack.length - 1; i >= 0; i -= 1) ops.push(callStack[i]);

  return ops.length > 0 ? ops : ['SRC'];
}

// Append a pcode mapper routine (label MAP_<id>) for a program-map mapper entry
// to an existing pcode image. Used when a service imports a mapper from the
// Mapping Librarian: the router emits `CALL MAP_<id> 0`, and this routine is the
// callee. The routine is pure pcode (SRC_GET / native ops / OUT_SET / RET).
export function emitMapperRoutinePcode(mapperEntry) {
  const id = String(mapperEntry?.id || '');
  const label = `MAP_${id.replace(/[^A-Za-z0-9_]/g, '_')}`;
  const lines = [`${label}:`];
  for (const item of mapperEntry?.items || []) {
    const ops = item.ops || compileConversionRuleToOps(item.conversionRule);
    lines.push(`SRC_GET "${String(item.sourcePath || '').replace(/"/g, '\\"')}"`);
    for (const op of ops) {
      if (op === 'SRC') continue; // SRC_GET already pushed the source value
      lines.push(op);
    }
    lines.push(`OUT_SET "${String(item.targetPath || '').replace(/"/g, '\\"')}"`);
  }
  lines.push('RET');
  return lines.join('\n');
}
