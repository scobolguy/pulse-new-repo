import { createDatabaseProvider } from '../src/backend/databaseProviders/index.mjs';

const db = createDatabaseProvider('mssql', { connectionString: process.env.MSSQL_DATABASE_CONNECTION_STRING });
try {
  const tables = await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN ('incoming_messages','outgoing_messages') ORDER BY TABLE_NAME");
  const counts = await db.query("SELECT 'incoming_messages' AS table_name, COUNT(*) AS row_count FROM incoming_messages WHERE correlation_id LIKE 'live-sqlserver-msmq-%' UNION ALL SELECT 'outgoing_messages', COUNT(*) FROM outgoing_messages WHERE correlation_id LIKE 'live-sqlserver-msmq-%'");
  console.log(JSON.stringify({ tables, counts }, null, 2));
} finally {
  await db.close();
}
