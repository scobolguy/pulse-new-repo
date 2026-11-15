const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SOURCE_CACHE = /^([A-Za-z_][A-Za-z0-9_]*)=([A-Za-z_][A-Za-z0-9_.-]*)\/([A-Za-z][A-Za-z0-9_-]{0,63})$/;
const SOURCE_COLUMNS = [
  { name: 'cache_key', type: 'string' },
  { name: 'device_json', type: 'string' },
  { name: 'observation_ms', type: 'integer' },
  { name: 'observation_sequence', type: 'integer' },
  { name: 'remaining_ttl_ms', type: 'integer' }
];
const RESERVED = new Set([
  'ALL', 'AND', 'AS', 'ASC', 'BY', 'DESC', 'FROM', 'INNER', 'JOIN', 'LEFT',
  'LIMIT', 'ON', 'OR', 'ORDER', 'OUTER', 'SELECT', 'UNION', 'WHERE'
]);

function tokenize(sql) {
  if (typeof sql !== 'string' || !sql.trim() || sql.length > 4096)
    throw new Error('Cache query must contain 1..4096 characters');
  const tokens = [];
  for (let index = 0; index < sql.length;) {
    const character = sql[index];
    if (/\s/.test(character)) { index += 1; continue; }
    if (sql.startsWith('--', index) || sql.startsWith('/*', index))
      throw new Error('Cache queries do not support SQL comments');
    if (character === "'") {
      let value = '';
      index += 1;
      while (index < sql.length) {
        if (sql[index] !== "'") { value += sql[index]; index += 1; continue; }
        if (sql[index + 1] === "'") { value += "'"; index += 2; continue; }
        index += 1;
        break;
      }
      if (sql[index - 1] !== "'" || index === 1)
        throw new Error('Unterminated SQL string literal');
      tokens.push({ type: 'string', value });
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const start = index++;
      while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index])) index += 1;
      const value = sql.slice(start, index);
      tokens.push({ type: 'word', value, upper: value.toUpperCase() });
      continue;
    }
    if (/[0-9]/.test(character)) {
      const start = index++;
      while (index < sql.length && /[0-9]/.test(sql[index])) index += 1;
      const value = Number(sql.slice(start, index));
      if (!Number.isSafeInteger(value)) throw new Error('SQL integer literal is outside the safe range');
      tokens.push({ type: 'integer', value });
      continue;
    }
    if (character === '-' && /[0-9]/.test(sql[index + 1] || '')) {
      const start = index++;
      while (index < sql.length && /[0-9]/.test(sql[index])) index += 1;
      const value = Number(sql.slice(start, index));
      if (!Number.isSafeInteger(value)) throw new Error('SQL integer literal is outside the safe range');
      tokens.push({ type: 'integer', value });
      continue;
    }
    const operator = ['<=', '>=', '<>', '!='].find(value => sql.startsWith(value, index));
    if (operator) { tokens.push({ type: 'operator', value: operator }); index += operator.length; continue; }
    if ('=<>(),.*;'.includes(character)) {
      tokens.push({ type: character === '=' || character === '<' || character === '>' ? 'operator' : character,
        value: character });
      index += 1;
      continue;
    }
    throw new Error(`Unsupported SQL character '${character}'`);
  }
  if (tokens.at(-1)?.type === ';') tokens.pop();
  if (tokens.some(token => token.type === ';')) throw new Error('Cache queries must be a single SQL statement');
  return tokens;
}

class QueryParser {
  constructor(tokens) { this.tokens = tokens; this.index = 0; }
  peek(value) {
    const token = this.tokens[this.index];
    return token?.type === 'word' ? token.upper === value : token?.value === value;
  }
  take(value) { if (!this.peek(value)) return false; this.index += 1; return true; }
  expect(value) {
    if (!this.take(value)) throw new Error(`Expected SQL ${value}`);
  }
  word(label = 'identifier') {
    const token = this.tokens[this.index];
    if (token?.type !== 'word' || !IDENTIFIER.test(token.value))
      throw new Error(`Expected SQL ${label}`);
    this.index += 1;
    return token.value;
  }
  column() {
    const first = this.word('column name');
    if (!this.take('.')) return { column: first };
    if (this.take('*')) return { qualifier: first, star: true };
    return { qualifier: first, column: this.word('column name') };
  }
  expression() {
    const token = this.tokens[this.index];
    if (token?.type === 'string' || token?.type === 'integer') {
      this.index += 1;
      return { kind: 'literal', value: token.value, type: token.type === 'string' ? 'string' : 'integer' };
    }
    if (token?.type === 'word' && ['TRUE', 'FALSE'].includes(token.upper)) {
      this.index += 1;
      return { kind: 'literal', value: token.upper === 'TRUE', type: 'boolean' };
    }
    if (token?.type === 'word') return { kind: 'column', ...this.column() };
    if (this.take('*')) return { kind: 'star' };
    throw new Error('Unsupported SQL expression');
  }
  projection() {
    const expression = this.expression();
    if (expression.kind === 'star' || expression.star) {
      if (this.take('AS')) throw new Error('SQL star projections cannot have aliases');
      return expression;
    }
    const alias = this.take('AS') ? this.word('projection alias') : '';
    return { ...expression, ...(alias ? { alias } : {}) };
  }
  table() {
    const name = this.word('table name');
    const alias = this.take('AS') ? this.word('table alias')
      : this.tokens[this.index]?.type === 'word' && !RESERVED.has(this.tokens[this.index].upper)
        ? this.word('table alias') : name;
    return { name, alias };
  }
  predicate() {
    const left = this.column();
    const operator = this.tokens[this.index];
    if (operator?.type !== 'operator' || !['=', '!=', '<>', '<', '<=', '>', '>='].includes(operator.value))
      throw new Error('Cache WHERE clauses support column comparisons only');
    this.index += 1;
    const right = this.expression();
    if (right.kind !== 'literal') throw new Error('Cache WHERE comparisons must compare a column to a literal');
    return { left, operator: operator.value, right };
  }
  select() {
    this.expect('SELECT');
    const projections = [this.projection()];
    while (this.take(',')) projections.push(this.projection());
    this.expect('FROM');
    const tables = [this.table()];
    const joins = [];
    while (true) {
      if (this.take('LEFT')) throw new Error('Cache queries support inner joins only');
      const type = this.take('INNER') ? 'inner' : '';
      if (!this.take('JOIN')) {
        if (type) throw new Error('Expected JOIN after join type');
        break;
      }
      const table = this.table();
      this.expect('ON');
      const left = this.column();
      const operator = this.tokens[this.index++];
      if (operator?.type !== 'operator' || operator.value !== '=')
        throw new Error('Portable cache JOIN requires an equality condition');
      joins.push({ type: type || 'inner', table, left, right: this.column() });
      tables.push(table);
    }
    let where = [];
    if (this.take('WHERE')) {
      where.push(this.predicate());
      while (this.take('AND')) where.push({ conjunction: 'and', ...this.predicate() });
    }
    return { projections, tables, joins, where };
  }
  parse() {
    const branches = [this.select()];
    while (this.take('UNION')) {
      this.expect('ALL');
      branches.push(this.select());
    }
    let orderBy = [];
    if (this.take('ORDER')) {
      this.expect('BY');
      do {
        const column = this.column();
        const direction = this.take('DESC') ? 'desc' : (this.take('ASC'), 'asc');
        orderBy.push({ ...column, direction });
      } while (this.take(','));
    }
    let limit = null;
    if (this.take('LIMIT')) {
      const token = this.tokens[this.index++];
      if (token?.type !== 'integer' || !Number.isSafeInteger(token.value) || token.value > 1000000)
        throw new Error('Cache query LIMIT must be an integer from 0 to 1000000');
      limit = token.value;
    }
    if (this.index !== this.tokens.length)
      throw new Error(`Unsupported SQL token '${this.tokens[this.index].value}'`);
    return { kind: 'select', branches, orderBy, limit };
  }
}

export function parseVirtualCacheSources(value) {
  if (typeof value !== 'string') throw new Error('Virtual cache sources must be text');
  const parts = value.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length < 1 || parts.length > 16) throw new Error('Virtual caches support 1..16 sources');
  const aliases = new Set();
  const sources = parts.map(part => {
    const match = part.match(SOURCE_CACHE);
    const localName = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(part);
    if (!match && !localName)
      throw new Error(`Invalid virtual cache source '${part}'; expected a local cache name or alias=serviceId/cacheName`);
    const [, alias, serviceId, cacheName] = match || [null, part, null, part];
    if (RESERVED.has(alias.toUpperCase()) || aliases.has(alias.toLowerCase()))
      throw new Error(`Duplicate or reserved virtual cache source alias '${alias}'`);
    aliases.add(alias.toLowerCase());
    return { alias, ...(localName ? { local: true, cacheName: part } : { serviceId, cacheName }) };
  });
  return sources;
}

function resolveColumn(column, tables, sourceFields) {
  const candidates = column.qualifier
    ? tables.filter(table => table.alias.toLowerCase() === column.qualifier.toLowerCase())
    : tables;
  if (!candidates.length) throw new Error(`Unknown SQL table alias '${column.qualifier}'`);
  const matches = candidates.filter(table =>
    sourceFields[table.name].some(field => field.name.toLowerCase() === column.column.toLowerCase()));
  if (!matches.length) throw new Error(`Unknown SQL column '${column.column}'`);
  if (matches.length > 1) throw new Error(`Ambiguous SQL column '${column.column}'`);
  return sourceFields[matches[0].name].find(field => field.name.toLowerCase() === column.column.toLowerCase());
}

function projectionFields(branch, sourceFields) {
  const aliases = new Set();
  const tables = branch.tables;
  const fields = [];
  for (const projection of branch.projections) {
    if (projection.kind === 'star' || projection.star) {
      if (projection.kind === 'star' && tables.length !== 1)
        throw new Error('SELECT * requires exactly one source table');
      const table = projection.qualifier
        ? tables.find(candidate => candidate.alias.toLowerCase() === projection.qualifier.toLowerCase())
        : tables[0];
      if (!table) throw new Error(`Unknown SQL table alias '${projection.qualifier}'`);
      for (const field of sourceFields[table.name]) {
        if (aliases.has(field.name.toLowerCase())) throw new Error(`Duplicate SQL output field '${field.name}'`);
        aliases.add(field.name.toLowerCase());
        fields.push(field);
      }
      continue;
    }
    let name, type;
    if (projection.kind === 'literal') {
      name = projection.alias;
      type = projection.type;
      if (!name) throw new Error('SQL literal projections require an AS alias');
    } else {
      const source = resolveColumn(projection, tables, sourceFields);
      name = projection.alias || source.name;
      type = source.type;
    }
    if (aliases.has(name.toLowerCase())) throw new Error(`Duplicate SQL output field '${name}'`);
    aliases.add(name.toLowerCase());
    fields.push({ name, type });
  }
  return fields;
}

export function parseCacheQuery(query, {
  cacheName, fields, viewFields = fields, virtual = false, sources = []
} = {}) {
  if (typeof query !== 'string' || !query.trim()) return null;
  const plan = new QueryParser(tokenize(query)).parse();
  const sourceFields = {};
  const aliases = new Map();
  if (virtual) {
    for (const source of sources) {
      aliases.set(source.alias.toLowerCase(), source.alias);
      sourceFields[source.alias] = SOURCE_COLUMNS;
    }
  } else {
    aliases.set(cacheName.toLowerCase(), cacheName);
    sourceFields[cacheName] = fields;
  }
  const usedSources = new Set();
  for (const branch of plan.branches) {
    const tableAliases = new Set();
    for (const table of branch.tables) {
      const canonical = aliases.get(table.name.toLowerCase());
      if (!canonical) throw new Error(`SQL source '${table.name}' is not declared for this cache`);
      if (tableAliases.has(table.alias.toLowerCase()))
        throw new Error(`Duplicate SQL table alias '${table.alias}'`);
      table.name = canonical;
      tableAliases.add(table.alias.toLowerCase());
      usedSources.add(canonical.toLowerCase());
    }
    for (const join of branch.joins) {
      const left = resolveColumn(join.left, branch.tables, sourceFields);
      const right = resolveColumn(join.right, branch.tables, sourceFields);
      if (left.type !== right.type) throw new Error('JOIN columns must have the same type');
    }
    for (const predicate of branch.where) {
      const field = resolveColumn(predicate.left, branch.tables, sourceFields);
      if (field.type !== predicate.right.type)
        throw new Error(`WHERE comparison for '${field.name}' must use a ${field.type} literal`);
      if (field.type === 'boolean' && !['=', '!=', '<>'].includes(predicate.operator))
        throw new Error('Boolean WHERE fields support equality comparisons only');
    }
    branch.outputFields = projectionFields(branch, sourceFields);
  }
  if (virtual && usedSources.size !== aliases.size)
    throw new Error('Every declared virtual cache source must be used by the SQL query');
  const expected = viewFields || [];
  if (!expected.length) throw new Error('A cache query requires a declared view field schema');
  const output = plan.branches[0].outputFields;
  const sameFields = (left, right) => left.length === right.length
    && left.every((field, index) => field.name === right[index].name && field.type === right[index].type);
  if (!sameFields(output, expected))
    throw new Error('Cache query projection does not match the declared view field schema');
  for (const branch of plan.branches.slice(1)) {
    if (!sameFields(branch.outputFields, output))
      throw new Error('UNION ALL branches must return the same fields and types');
  }
  for (const order of plan.orderBy) {
    if (order.qualifier)
      throw new Error('ORDER BY must use a selected output field');
    if (!output.some(field => field.name.toLowerCase() === order.column.toLowerCase()))
      throw new Error(`ORDER BY field '${order.column}' is not selected`);
  }
  return plan;
}

function rowField(row, name) {
  const key = Object.keys(row || {}).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : row[key];
}

function columnValue(column, scope, tables) {
  if (column.qualifier) {
    const source = scope.get(column.qualifier.toLowerCase());
    if (!source) throw new Error(`Unknown SQL table alias '${column.qualifier}'`);
    return rowField(source.row, column.column);
  }
  const matches = tables.filter(table => {
    const source = scope.get(table.alias.toLowerCase());
    return source && rowField(source.row, column.column) !== undefined;
  });
  if (matches.length !== 1) throw new Error(`Ambiguous or missing SQL column '${column.column}'`);
  return rowField(scope.get(matches[0].alias.toLowerCase()).row, column.column);
}

function compareValues(left, right) {
  if (typeof left !== typeof right) throw new Error('SQL comparison values have different types');
  if (typeof left === 'string') return left < right ? -1 : left > right ? 1 : 0;
  if (typeof left === 'number' || typeof left === 'boolean') return left < right ? -1 : left > right ? 1 : 0;
  throw new Error('Unsupported SQL comparison value');
}

function matchesWhere(predicate, scope, tables) {
  const comparison = compareValues(columnValue(predicate.left, scope, tables), predicate.right.value);
  switch (predicate.operator) {
    case '=': return comparison === 0;
    case '!=':
    case '<>': return comparison !== 0;
    case '<': return comparison < 0;
    case '<=': return comparison <= 0;
    case '>': return comparison > 0;
    case '>=': return comparison >= 0;
    default: throw new Error(`Unsupported SQL operator '${predicate.operator}'`);
  }
}

function mergeMetadata(left, right) {
  return {
    observationMs: Math.min(left.observationMs, right.observationMs),
    observationSequence: Math.max(left.observationSequence, right.observationSequence),
    remainingTTLms: Math.min(left.remainingTTLms, right.remainingTTLms)
  };
}

function projectRow(branch, scope) {
  const row = {};
  for (const projection of branch.projections) {
    if (projection.kind === 'star' || projection.star) {
      const table = projection.qualifier
        ? branch.tables.find(candidate => candidate.alias.toLowerCase() === projection.qualifier.toLowerCase())
        : branch.tables[0];
      for (const [name, value] of Object.entries(scope.get(table.alias.toLowerCase()).row))
        row[name] = value;
      continue;
    }
    if (projection.kind === 'literal') {
      row[projection.alias] = projection.value;
      continue;
    }
    const sourceName = projection.column;
    row[projection.alias || sourceName] = columnValue(projection, scope, branch.tables);
  }
  return row;
}

export function executeCacheQuery(plan, sourceRows, { maxRows = 800, maxJoinComparisons = 8192 } = {}) {
  if (plan?.kind !== 'select' || !Array.isArray(plan.branches)
    || !Number.isSafeInteger(maxRows) || maxRows < 1
    || !Number.isSafeInteger(maxJoinComparisons) || maxJoinComparisons < 1)
    throw new Error('Invalid cache query execution plan');
  const result = [];
  let comparisons = 0;
  for (const branch of plan.branches) {
    const firstTable = branch.tables[0];
    const firstRows = sourceRows[firstTable.name];
    if (!Array.isArray(firstRows)) throw new Error(`SQL source '${firstTable.name}' is unavailable`);
    let rows = firstRows.map(source => ({
      scope: new Map([[firstTable.alias.toLowerCase(), source]]),
      metadata: source.metadata
    }));
    for (const join of branch.joins) {
      const table = join.table;
      const candidates = sourceRows[table.name];
      if (!Array.isArray(candidates)) throw new Error(`SQL source '${table.name}' is unavailable`);
      const joined = [];
      for (const current of rows) {
        for (const candidate of candidates) {
          if (++comparisons > maxJoinComparisons)
            throw new Error('Cache query join comparison limit exceeded');
          const scope = new Map(current.scope);
          scope.set(table.alias.toLowerCase(), candidate);
          if (compareValues(columnValue(join.left, scope, branch.tables),
            columnValue(join.right, scope, branch.tables)) !== 0) continue;
          joined.push({ scope, metadata: mergeMetadata(current.metadata, candidate.metadata) });
          if (joined.length > maxRows) throw new Error('Cache query result row limit exceeded');
        }
      }
      rows = joined;
    }
    for (const predicate of branch.where) {
      rows = rows.filter(item => matchesWhere(predicate, item.scope, branch.tables));
    }
    for (const item of rows) {
      result.push({ row: projectRow(branch, item.scope), metadata: item.metadata });
      if (result.length > maxRows) throw new Error('Cache query result row limit exceeded');
    }
  }
  if (plan.orderBy?.length) {
    result.sort((left, right) => {
      for (const order of plan.orderBy) {
        const comparison = compareValues(
          rowField(left.row, order.column), rowField(right.row, order.column));
        if (comparison) return order.direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
  }
  return plan.limit === null ? result : result.slice(0, plan.limit);
}
