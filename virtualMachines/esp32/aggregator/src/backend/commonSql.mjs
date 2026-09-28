const IDENTIFIER = '[A-Za-z_][A-Za-z0-9_]*';

function identifier(value) {
  const result = String(value || '').trim();
  if (!new RegExp(`^${IDENTIFIER}$`).test(result)) throw new Error(`Unsafe SQL identifier: ${result}`);
  return result;
}

function splitDefinitions(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (value[index] === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

export function parseCommonSql(statement) {
  const sql = String(statement || '').trim().replace(/;\s*$/, '');
  let match = sql.match(new RegExp(`^CREATE\\s+DATABASE\\s+(${IDENTIFIER})$`, 'i'));
  if (match) return { operation: 'createDatabase', database: identifier(match[1]) };
  match = sql.match(new RegExp(`^CREATE\\s+SCHEMA\\s+(${IDENTIFIER})$`, 'i'));
  if (match) return { operation: 'createSchema', schemaName: identifier(match[1]) };

  match = sql.match(new RegExp(`^CREATE\\s+INDEX\\s+(${IDENTIFIER})\\s+ON\\s+(${IDENTIFIER})\\s*\\(([^)]+)\\)$`, 'i'));
  if (match) return { operation: 'createIndex', index: { name: identifier(match[1]), table: identifier(match[2]), columns: match[3].split(',').map(identifier) } };

  match = sql.match(new RegExp(`^CREATE\\s+TABLE\\s+(${IDENTIFIER})\\s*\\((.+)\\)$`, 'i'));
  if (match) {
    const columns = {};
    for (const definition of splitDefinitions(match[2])) {
      const column = definition.trim().match(new RegExp(`^(${IDENTIFIER})\\s+(.+)$`, 'i'));
      if (!column) throw new Error(`Invalid column definition: ${definition}`);
      columns[identifier(column[1])] = column[2].trim();
    }
    return { operation: 'createTable', schema: { table: identifier(match[1]), columns } };
  }

  match = sql.match(new RegExp(`^SELECT\\s+.+\\s+FROM\\s+(${IDENTIFIER})(?:\\s+WHERE\\s+.+)?$`, 'i'));
  if (match) return { operation: 'query', sql };
  throw new Error('Supported common SQL: CREATE DATABASE, CREATE SCHEMA, CREATE TABLE, CREATE INDEX, SELECT');
}
