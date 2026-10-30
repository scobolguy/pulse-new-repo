import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { createMssqlInventoryStore } from '../src/inventory-mssql.mjs';

export const sqlEnabled = Boolean(process.env.PATHWAY_TEST_MSSQL_CONNECTION_STRING);
export async function createSqlFixture(options = {}) {
  const require = createRequire(new URL('../../aggregator/package.json', import.meta.url));
  const sql = require('mssql/msnodesqlv8.js');
  const connectionString = process.env.PATHWAY_TEST_MSSQL_CONNECTION_STRING;
  const database = `PathwayTest_${randomBytes(8).toString('hex')}`;
  const admin = await new sql.ConnectionPool({ driver: 'msnodesqlv8', connectionString }).connect();
  const stores = [];
  let inspector;
  const close = async () => {
    for (const store of stores) await store.close();
    if (inspector) await inspector.close();
    await admin.request().query(`IF DB_ID(N'${database}') IS NOT NULL BEGIN
      ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${database}]; END;`);
    await admin.close();
  };
  try {
    await admin.request().query(`CREATE DATABASE [${database}]`);
    const config = { connectionString: `${connectionString};Database=${database};`, ...options };
    const open = async () => {
      const store = await createMssqlInventoryStore(config);
      stores.push(store);
      return store;
    };
    const store = await open();
    inspector = await new sql.ConnectionPool({ driver: 'msnodesqlv8', connectionString: config.connectionString }).connect();
    return { store, open, close, query: text => inspector.request().query(text) };
  } catch (error) { await close(); throw error; }
}
