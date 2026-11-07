export const SPECIFICATION = 'https://learn.microsoft.com/en-us/dotnet/visual-basic/reference/language-specification/';
const chapters = [
  'lexical-grammar', 'preprocessing-directives', 'general-concepts', 'attributes',
  'source-files-and-namespaces', 'types', 'conversions', 'type-members', 'statements', 'expressions', 'overload-resolution'
];

export function summarizeCoverage(cases) {
  return chapters.map(chapter => {
    const items = cases.filter(item => item.clause.split('#')[0] === chapter);
    const supported = items.filter(item => item.kind !== 'unsupported');
    return {
      chapter, reference: SPECIFICATION + chapter,
      status: supported.length ? 'partial' : items.length ? 'unsupported-probes-only' : 'not-tested',
      caseIds: items.map(item => item.id), supportedCases: supported.length,
      unsupportedProbes: items.length - supported.length
    };
  });
}

export function validateInventory(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new Error('Empty VB validation inventory');
  const ids = new Set();
  for (const item of cases) {
    if (!/^VB-[A-Z]+-\d{3}$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid/duplicate VB case ${item.id}`);
    ids.add(item.id);
    if (!chapters.includes(item.clause?.split('#')[0]) || !item.clause.includes('#') || !item.source?.trim())
      throw new Error(`Missing VB reference or source for ${item.id}`);
    if (!['positive', 'negative', 'runtime-error', 'unsupported'].includes(item.kind)
      || !['core', 'overloads', 'numeric', 'integers', 'negative', 'runtime', 'unsupported'].includes(item.suite)
      || (item.kind === 'unsupported') !== (item.suite === 'unsupported')
      || (item.kind === 'runtime-error') !== (item.suite === 'runtime'))
      throw new Error(`Invalid VB accounting for ${item.id}`);
    if (item.kind === 'positive') {
      if (!Array.isArray(item.stdout) || !item.stdout.every(value => typeof value === 'string'))
        throw new Error(`Missing exact VB stdout for ${item.id}`);
    } else {
      if (!item.diagnostic || item.kind === 'runtime-error' && !item.errorName)
        throw new Error(`Missing VB diagnostic for ${item.id}`);
      new RegExp(item.diagnostic);
    }
  }
}
