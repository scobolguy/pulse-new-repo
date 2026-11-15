const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const FIELD_TYPES = new Set(['integer', 'string', 'boolean']);

export function parseCacheFields(value) {
  if (typeof value !== 'string' || !value.trim())
    return { fields: [], error: 'Cache fields must be a non-empty comma-separated schema' };
  const fields = [];
  const names = new Set();
  for (const part of value.split(',')) {
    const [rawName, rawType, ...extra] = part.split(':');
    const name = rawName?.trim();
    const type = rawType?.trim();
    if (extra.length || !FIELD_NAME.test(name || '') || !FIELD_TYPES.has(type) || names.has(name))
      return { fields: [], error: `Invalid or duplicate cache field '${part.trim()}'` };
    names.add(name);
    fields.push({ name, type });
  }
  if (fields.length > 32) return { fields: [], error: 'Cache schemas support at most 32 fields' };
  return { fields, error: null };
}

export function cacheConstraintError(fields, uniqueBy, latestBy) {
  const byName = new Map(fields.map(field => [field.name, field]));
  if (uniqueBy && !byName.has(uniqueBy)) return `uniqueBy field '${uniqueBy}' is not declared`;
  if (latestBy && !byName.has(latestBy)) return `latestBy field '${latestBy}' is not declared`;
  if (latestBy && !['integer', 'string'].includes(byName.get(latestBy)?.type))
    return `latestBy field '${latestBy}' must be an integer or ISO timestamp string`;
  return null;
}
