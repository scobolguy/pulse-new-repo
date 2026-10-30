import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMssqlInventoryStore } from '../pathway/src/inventory-mssql.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export async function loadConfiguration() {
  const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
  if (config.database?.provider !== 'mssql') throw new Error('pathwayDemo requires an explicit MSSQL database configuration');
  return config;
}
export async function openDatabase(config) {
  return createMssqlInventoryStore({
    ...config.database,
    connectionString: process.env[config.database.connectionStringEnvironment] || config.database.connectionString,
  });
}
