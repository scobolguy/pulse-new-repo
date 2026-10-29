// COBOL 85 constructs the grammar accepts but the p-code generator cannot honour yet.
// Rejecting them up front keeps the compiler from emitting silently wrong programs.
const UNSUPPORTED_CONTEXTS = new Map(Object.entries({
  SwitchNameClause: 'SPECIAL-NAMES switch clause',
  CurrencyClause: 'SPECIAL-NAMES CURRENCY SIGN clause',
  CollatingSequenceClause: 'PROGRAM COLLATING SEQUENCE',
  IoControlParagraph: 'I-O-CONTROL paragraph',
  CodeSetClause: 'CODE-SET clause',
  ReferenceModifier: 'Reference modification on this operand',
  StopLiteralStatement: 'STOP literal',
}));

const ALL_ARGUMENT_FUNCTIONS = new Set([
  'MAX', 'MIN', 'MEAN', 'MEDIAN', 'MIDRANGE', 'RANGE', 'SUM',
  'VARIANCE', 'STANDARD-DEVIATION', 'ORD-MAX', 'ORD-MIN', 'PRESENT-VALUE'
]);

// SIGN, BLANK WHEN ZERO and OCCURS DEPENDING are accepted: values are held as abstract
// decimals and tables are allocated at their maximum size, so they do not change results.
export function findUnsupportedFeature(tree) {
  const pending = [{ node: tree, intrinsicFunction: null }];
  while (pending.length) {
    const { node, intrinsicFunction: parentFunction } = pending.pop();
    if (!node) continue;
    const kind = String(node.constructor?.name || '').replace(/Context$/, '');
    const intrinsicFunction = kind === 'IntrinsicFunction'
      ? String(node.functionName?.()?.getText?.() || '').toUpperCase()
      : parentFunction;
    const feature = (kind === 'ReferenceModifier' && node.parentCtx?.constructor?.name === 'DataReferenceContext'
      ? null
      : UNSUPPORTED_CONTEXTS.get(kind))
      || (kind === 'DataReference' && node.ALL?.() && !ALL_ARGUMENT_FUNCTIONS.has(intrinsicFunction)
        ? 'Subscript ALL'
        : null);
    if (feature) return { feature, line: node.start?.line ?? null };
    for (let index = (node.getChildCount?.() || 0) - 1; index >= 0; index -= 1) {
      pending.push({ node: node.getChild(index), intrinsicFunction });
    }
  }
  return null;
}

export function assertSupportedFeatures(tree) {
  const found = findUnsupportedFeature(tree);
  if (!found) return;
  const where = found.line ? ` (line ${found.line})` : '';
  throw new Error(`[COBOLISH] ${found.feature} is recognized but not yet implemented${where}`);
}
