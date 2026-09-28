import { parseCommonSql } from './commonSql.mjs';

export function registerDatabaseRoutes(app, { databaseManagers = new Map(), resolveBinding }) {
  let activeManifest = { bySymbol: {} };

  app.get('/api/registry/databases', async (req, res) => {
    const databases = await Promise.all(Array.from(databaseManagers.entries()).map(async ([managerId, manager]) => {
      const boundTables = Object.values(activeManifest.bySymbol || {})
        .filter(binding => binding.kind === 'database' && binding.managerId === managerId)
        .map(binding => ({
          symbol: binding.symbol,
          physicalName: binding.physicalName,
          typeName: binding.typeName || null
        }));
      let discoveredTables = [];
      let discoveryError = null;
      if (typeof manager.listTables === 'function') {
        try {
          discoveredTables = await manager.listTables();
        } catch (error) {
          discoveryError = String(error?.message || error);
        }
      }
      const tables = [...boundTables, ...discoveredTables.map(table => ({
        symbol: null,
          physicalName: table.table_name || table.TABLE_NAME || table.name,
          rowCount: Number(table.row_count ?? table.rowCount ?? 0),
          typeName: null,
        discovered: true
      }))].filter((table, index, all) => table.physicalName && all.findIndex(item => item.physicalName === table.physicalName) === index);
      return {
        managerId,
        serverId: managerId,
        name: managerId === 'db-mssql' ? 'Microsoft SQL Server' : managerId === 'db-access' ? 'Microsoft Access' : managerId === 'db-mysql' ? 'MySQL' : managerId,
        provider: manager.provider,
        engine: manager.provider,
        status: 'available',
        tables,
        discoveryError
      };
    }));
    return res.json({ databases });
  });

  app.post('/api/deployments/bindings', (req, res) => {
    const manifest = req.body?.manifest;
    if (!manifest || typeof manifest !== 'object' || !manifest.bySymbol) {
      return res.status(400).json({ error: 'manifest.bySymbol is required' });
    }
    activeManifest = manifest;
    return res.json({ ok: true, bindingCount: Object.keys(activeManifest.bySymbol).length });
  });

  const resolveActiveBinding = (symbol, kind) => {
    const binding = activeManifest.bySymbol[String(symbol || '').trim()];
    if (!binding) throw new Error(`No deployment binding exists for logical resource '${symbol}'`);
    if (binding.kind !== kind) throw new Error(`Logical resource '${symbol}' is a ${binding.kind}, expected ${kind}`);
    return binding;
  };

  app.post('/api/databases/:logicalSymbol/table', async (req, res) => {
    try {
      const binding = resolveBinding
        ? resolveBinding(req.params.logicalSymbol, 'database')
        : resolveActiveBinding(req.params.logicalSymbol, 'database');
      const manager = databaseManagers.get(binding.managerId);
      if (!manager) return res.status(404).json({ error: `Database manager not found: ${binding.managerId}` });
      const result = await manager.createTable(req.body?.schema || {});
      return res.status(201).json({ ok: true, binding, result });
    } catch (error) { return res.status(400).json({ error: error.message }); }
  });

  app.post('/api/databases/:logicalSymbol/insert', async (req, res) => {
    try {
      const binding = resolveBinding
        ? resolveBinding(req.params.logicalSymbol, 'database')
        : resolveActiveBinding(req.params.logicalSymbol, 'database');
      const manager = databaseManagers.get(binding.managerId);
      if (!manager) return res.status(404).json({ error: `Database manager not found: ${binding.managerId}` });
      const result = await manager.insert(req.body?.schema || {}, req.body?.record || {});
      return res.status(201).json({ ok: true, binding, result });
    } catch (error) { return res.status(400).json({ error: error.message }); }
  });

  app.post('/api/databases/:logicalSymbol/sql', async (req, res) => {
    try {
      const binding = resolveBinding
        ? resolveBinding(req.params.logicalSymbol, 'database')
        : resolveActiveBinding(req.params.logicalSymbol, 'database');
      const manager = databaseManagers.get(binding.managerId);
      if (!manager) return res.status(404).json({ error: `Database manager not found: ${binding.managerId}` });
      const command = parseCommonSql(req.body?.statement || req.body?.sql || '');
      const argument = command.operation === 'createDatabase'
        ? command.database
        : command.operation === 'createSchema'
          ? command.schemaName
        : command.operation === 'createTable'
          ? command.schema
          : command.operation === 'createIndex'
            ? command.index
            : null;
      if (typeof manager[command.operation] !== 'function') {
        return res.status(400).json({ error: `Provider '${manager.provider}' does not support ${command.operation}` });
      }
      const result = command.operation === 'query'
        ? await manager.query(command.sql, req.body?.parameters || [])
        : await manager[command.operation](argument);
      return res.json({ ok: true, binding, command, result });
    } catch (error) { return res.status(400).json({ error: error.message }); }
  });

  app.post('/api/databases/:logicalSymbol/schema', async (req, res) => {
    try {
      const binding = resolveBinding ? resolveBinding(req.params.logicalSymbol, 'database') : resolveActiveBinding(req.params.logicalSymbol, 'database');
      const manager = databaseManagers.get(binding.managerId);
      if (!manager) return res.status(404).json({ error: `Database manager not found: ${binding.managerId}` });
      const result = await manager.createSchema(req.body?.name);
      return res.status(201).json({ ok: true, binding, result });
    } catch (error) { return res.status(400).json({ error: error.message }); }
  });

  app.get('/api/databases/:logicalSymbol/schemas', async (req, res) => {
    try {
      const binding = resolveBinding ? resolveBinding(req.params.logicalSymbol, 'database') : resolveActiveBinding(req.params.logicalSymbol, 'database');
      const manager = databaseManagers.get(binding.managerId);
      if (!manager) return res.status(404).json({ error: `Database manager not found: ${binding.managerId}` });
      return res.json({ ok: true, binding, schemas: await manager.listSchemas() });
    } catch (error) { return res.status(400).json({ error: error.message }); }
  });

  app.delete('/api/databases/:logicalSymbol/schema/:schemaName', async (req, res) => {
    try {
      const binding = resolveBinding ? resolveBinding(req.params.logicalSymbol, 'database') : resolveActiveBinding(req.params.logicalSymbol, 'database');
      const manager = databaseManagers.get(binding.managerId);
      if (!manager) return res.status(404).json({ error: `Database manager not found: ${binding.managerId}` });
      return res.json({ ok: true, binding, result: await manager.dropSchema(req.params.schemaName) });
    } catch (error) { return res.status(400).json({ error: error.message }); }
  });
}