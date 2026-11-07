export const SPECIFICATION = 'https://github.com/dotnet/csharpstandard/tree/standard-v7/standard';

const chapters = [
  [6, 'Lexical structure', 'lexical-structure', 'ASCII tokens, comments, strings; no preprocessing or Unicode identifiers'],
  [7, 'Basic concepts', 'basic-concepts', 'Entry points, local scopes, static accessibility; no object lifetime model'],
  [8, 'Types', 'types', '8-/16-bit integers, Int32, bool, string and method type parameters only'],
  [9, 'Variables', 'variables', 'Locals and value parameters; conservative definite assignment'],
  [10, 'Conversions', 'conversions', 'Scalar identity and integer casts/widening; no general conversion system'],
  [11, 'Patterns and pattern matching', 'patterns', 'Unsupported'],
  [12, 'Expressions', 'expressions', 'Scalar operators, calls and conditionals; no full expression language'],
  [13, 'Statements', 'statements', 'Blocks, selection, loops and returns; no exception handling or iterators'],
  [14, 'Namespaces', 'namespaces', 'Block namespace and System import only'],
  [15, 'Classes', 'classes', 'Static scalar and generic methods; no objects, fields or inheritance'],
  [16, 'Structs', 'structs', 'Unsupported'],
  [17, 'Arrays', 'arrays', 'Unsupported'],
  [18, 'Interfaces', 'interfaces', 'Unsupported'],
  [19, 'Enums', 'enums', 'Unsupported'],
  [20, 'Delegates', 'delegates', 'Unsupported'],
  [21, 'Exceptions', 'exceptions', 'VM faults only; C# exception objects and handling unsupported'],
  [22, 'Attributes', 'attributes', 'Unsupported'],
  [23, 'Unsafe code', 'unsafe-code', 'Unsupported']
];

export function summarizeCoverage(cases) {
  return chapters.map(([chapter, title, file, scope]) => {
    const matches = cases.filter(item => item.clause.split(';').some(clause =>
      Number(clause.trim().split('.')[0]) === chapter));
    const supported = matches.filter(item => item.kind !== 'unsupported');
    return {
      chapter, title, reference: `${SPECIFICATION}/${file}.md`, scope,
      status: supported.length ? 'partial' : matches.length ? 'unsupported-probes-only' : 'not-tested',
      caseIds: matches.map(item => item.id),
      supportedCases: supported.length,
      unsupportedProbes: matches.length - supported.length
    };
  });
}

export function validateInventory(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new Error('Validation inventory must not be empty');
  const ids = new Set();
  for (const item of cases) {
    if (!/^CS-[A-Z]+-\d{3}$/.test(item.id) || ids.has(item.id))
      throw new Error(`Invalid or duplicate case id: ${item.id}`);
    ids.add(item.id);
    if (!['core', 'generics', 'overloads', 'numeric', 'integers', 'negative', 'runtime', 'unsupported'].includes(item.suite)
      || !['positive', 'negative', 'runtime-error', 'unsupported'].includes(item.kind))
      throw new Error(`Invalid suite or kind for ${item.id}`);
    if ((item.kind === 'unsupported') !== (item.suite === 'unsupported')
      || (item.kind === 'runtime-error') !== (item.suite === 'runtime'))
      throw new Error(`Inconsistent result accounting for ${item.id}`);
    if (typeof item.source !== 'string' || !item.source.trim()
      || typeof item.clause !== 'string' || !/^\d+(?:\.\d+)*(?:;\s*\d+(?:\.\d+)*)*$/.test(item.clause))
      throw new Error(`Missing source or invalid clause for ${item.id}`);
    if (item.kind === 'positive') {
      if (!Array.isArray(item.stdout) || !item.stdout.every(line => typeof line === 'string'))
        throw new Error(`Missing exact stdout for ${item.id}`);
    } else {
      if (typeof item.diagnostic !== 'string' || !item.diagnostic)
        throw new Error(`Missing diagnostic for ${item.id}`);
      new RegExp(item.diagnostic);
      if (item.kind === 'runtime-error' && !item.errorName)
        throw new Error(`Missing runtime exception type for ${item.id}`);
    }
  }
}
