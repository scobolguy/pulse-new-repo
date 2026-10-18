export function createInfrastructureReadiness({
  sqlConnectionString, rabbitUrl, sqlDriver = '', importImpl = specifier => import(specifier),
  timeoutMs = 2000,
}) {
  return {
    async database() {
      const connectionString = sqlConnectionString();
      if (!connectionString) throw new Error('SQL Server connection is not configured');
      const module = await importImpl(sqlDriver === 'msnodesqlv8' ? 'mssql/msnodesqlv8.js' : 'mssql');
      const sql = module.default || module;
      const pool = new sql.ConnectionPool(sqlDriver === 'msnodesqlv8'
        ? { connectionString, driver: 'msnodesqlv8' } : connectionString);
      pool.config.connectionTimeout = timeoutMs;
      pool.config.requestTimeout = timeoutMs;
      try {
        await pool.connect();
        const result = await pool.request().query('SELECT 1 AS pulse_ready');
        if (result.recordset?.[0]?.pulse_ready !== 1) throw new Error('SQL Server readiness query returned an invalid result');
      } finally {
        await pool.close();
      }
    },
    async rabbitmq() {
      const module = await importImpl('amqplib');
      const amqp = module.default || module;
      const connection = await amqp.connect(rabbitUrl(), { timeout: timeoutMs });
      let connectionError;
      const onError = error => { connectionError = error; };
      connection.on('error', onError);
      try {
        const channel = await connection.createChannel();
        await channel.close();
        if (connectionError) throw connectionError;
      } finally {
        await connection.close();
        connection.removeListener('error', onError);
      }
    },
  };
}

export function registerInfrastructureReadinessRoutes(app, { probes, ownerAggregatorId }) {
  const observations = new Map();
  const pending = new Map();
  for (const id of ['database', 'rabbitmq']) {
    app.get(`/api/runtime/infrastructure/${id}/ready`, async (_req, res) => {
      if (!observations.has(id) || Date.now() - observations.get(id).at >= 5000) {
        if (!pending.has(id)) {
          pending.set(id, (async () => {
            const body = { serviceId: id === 'database' ? 'pulse-database' : 'pulse-rabbitmq',
              instanceId: `${id}:${ownerAggregatorId}` };
            try {
              await probes[id]();
              observations.set(id, { at: Date.now(), body: { ...body, ready: true } });
            } catch (error) {
              // Driver errors can contain connection URLs; never publish credentials.
              const reason = error.message.replace(/(amqps?:\/\/)[^@\s]+@/gi, '$1[redacted]@');
              observations.set(id, { at: Date.now(), body: { ...body, ready: false, error: reason } });
            }
          })().finally(() => pending.delete(id)));
        }
        await pending.get(id);
      }
      const { body } = observations.get(id);
      res.status(body.ready ? 200 : 503).json(body);
    });
  }
}
