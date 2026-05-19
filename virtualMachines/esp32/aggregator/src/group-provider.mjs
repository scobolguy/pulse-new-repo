import fs from 'fs';

function uniqueStrings(items) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const value = String(item || '').trim();
    if (!value) continue;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function normalizeGroup(raw) {
  const now = new Date().toISOString();
  return {
    groupId: String(raw?.groupId || '').trim(),
    label: String(raw?.label || raw?.groupId || '').trim(),
    description: String(raw?.description || '').trim(),
    privileges: uniqueStrings(raw?.privileges),
    createdAt: String(raw?.createdAt || now),
    updatedAt: String(raw?.updatedAt || now),
    deletedAt: raw?.deletedAt ? String(raw.deletedAt) : null,
    deletedBy: raw?.deletedBy ? String(raw.deletedBy) : null
  };
}

function toOdbcTrustedConnectionString(connectionString) {
  let cs = String(connectionString || '').trim();
  if (!cs) return cs;
  cs = cs.replace(/TrustServerCertificate\s*=\s*[^;]+;?/ig, '');
  cs = cs.replace(/Encrypt\s*=\s*[^;]+;?/ig, '');
  if (!/Driver\s*=\s*\{/i.test(cs)) {
    cs = `Driver={ODBC Driver 17 for SQL Server};${cs}`;
  }
  cs = cs.replace(/Trusted_Connection\s*=\s*true/ig, 'Trusted_Connection=Yes');
  return cs;
}

class FileGroupProvider {
  constructor({ filePath }) {
    this.filePath = filePath;
  }

  _readStore() {
    if (!fs.existsSync(this.filePath)) {
      const initial = {
        version: 1,
        updatedAt: new Date().toISOString(),
        groups: [
          {
            groupId: 'administrators',
            label: 'Administrators',
            description: 'Administrative users with full rights',
            privileges: ['*'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            deletedBy: null
          }
        ]
      };
      fs.writeFileSync(this.filePath, `${JSON.stringify(initial, null, 2)}\n`, 'utf-8');
      return initial;
    }

    const rawText = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = rawText.trim() ? JSON.parse(rawText) : { version: 1, updatedAt: new Date().toISOString(), groups: [] };
    const groups = Array.isArray(parsed.groups) ? parsed.groups.map(normalizeGroup).filter(group => group.groupId) : [];
    return {
      version: Number(parsed.version || 1),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      groups
    };
  }

  _writeStore(store) {
    const next = {
      version: Number(store?.version || 1),
      updatedAt: new Date().toISOString(),
      groups: Array.isArray(store?.groups) ? store.groups.map(normalizeGroup) : []
    };
    fs.writeFileSync(this.filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
  }

  async listGroups({ includeDeleted = false } = {}) {
    const store = this._readStore();
    return includeDeleted ? store.groups : store.groups.filter(group => !group.deletedAt);
  }

  async getGroupById(groupId) {
    const id = String(groupId || '').trim();
    if (!id) return null;
    const store = this._readStore();
    return store.groups.find(group => group.groupId === id) || null;
  }

  async createGroup(input) {
    const id = String(input?.groupId || '').trim();
    if (!id) throw new Error('groupId is required');

    const store = this._readStore();
    const existing = store.groups.find(group => group.groupId === id);
    if (existing && !existing.deletedAt) {
      throw new Error('Group already exists');
    }

    const now = new Date().toISOString();
    const next = normalizeGroup({
      groupId: id,
      label: input?.label || id,
      description: input?.description || '',
      privileges: input?.privileges || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null
    });

    if (existing) {
      store.groups = store.groups.map(group => (group.groupId === id ? next : group));
    } else {
      store.groups.push(next);
    }

    this._writeStore(store);
    return next;
  }

  async updateGroup(groupId, updates) {
    const id = String(groupId || '').trim();
    if (!id) throw new Error('groupId is required');

    const store = this._readStore();
    const found = store.groups.find(group => group.groupId === id);
    if (!found) throw new Error('Group not found');
    if (found.deletedAt) throw new Error('Cannot modify a soft-deleted group');

    const merged = normalizeGroup({
      ...found,
      label: Object.prototype.hasOwnProperty.call(updates || {}, 'label') ? updates.label : found.label,
      description: Object.prototype.hasOwnProperty.call(updates || {}, 'description') ? updates.description : found.description,
      privileges: Object.prototype.hasOwnProperty.call(updates || {}, 'privileges') ? updates.privileges : found.privileges,
      updatedAt: new Date().toISOString()
    });

    store.groups = store.groups.map(group => (group.groupId === id ? merged : group));
    this._writeStore(store);
    return merged;
  }

  async softDeleteGroup(groupId, { deletedBy = 'system-admin' } = {}) {
    const id = String(groupId || '').trim();
    if (!id) throw new Error('groupId is required');

    const store = this._readStore();
    const found = store.groups.find(group => group.groupId === id);
    if (!found) throw new Error('Group not found');
    if (found.deletedAt) return found;

    const next = normalizeGroup({
      ...found,
      deletedAt: new Date().toISOString(),
      deletedBy: String(deletedBy || 'system-admin').trim() || 'system-admin',
      updatedAt: new Date().toISOString()
    });

    store.groups = store.groups.map(group => (group.groupId === id ? next : group));
    this._writeStore(store);
    return next;
  }
}

class MssqlGroupProvider {
  constructor({ connectionString, tableName = 'UserGroups' }) {
    this.connectionString = connectionString;
    this.tableName = tableName;
    this._pool = null;
    this._sql = null;
  }

  _buildConnectionCandidates() {
    const input = String(this.connectionString || '').trim();
    const candidates = [];
    const add = (value) => {
      const normalized = String(value || '').trim();
      if (!normalized) return;
      if (!candidates.includes(normalized)) candidates.push(normalized);
    };

    add(input);

    if (/localhost\\SQLEXPRESS/i.test(input)) {
      add(input.replace(/localhost\\SQLEXPRESS/ig, '.\\SQLEXPRESS'));
    }
    if (/\.\\SQLEXPRESS/i.test(input)) {
      add(input.replace(/\.\\SQLEXPRESS/ig, 'localhost\\SQLEXPRESS'));
    }

    return candidates;
  }

  async _getPool() {
    if (this._pool) return this._pool;
    let mssqlModule;
    try {
      mssqlModule = await import('mssql');
    } catch {
      throw new Error('MSSQL provider requires the mssql package to be installed');
    }
    this._sql = mssqlModule.default ?? mssqlModule;
    const candidates = this._buildConnectionCandidates();
    let lastError = null;
    for (const candidate of candidates) {
      try {
        this._pool = await this._sql.connect(candidate);
        if (candidate !== String(this.connectionString || '').trim()) {
          console.warn('[GROUPS] Primary MSSQL connection failed; connected using local fallback target.');
        }
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!this._pool) {
      try {
        const nativeModule = await import('mssql/msnodesqlv8.js');
        this._sql = nativeModule.default ?? nativeModule;
        for (const candidate of candidates) {
          try {
            this._pool = await this._sql.connect({ connectionString: toOdbcTrustedConnectionString(candidate) });
            console.warn('[GROUPS] Using native msnodesqlv8 fallback driver for SQL connectivity.');
            break;
          } catch (e) {
            lastError = e;
          }
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (!this._pool) {
      throw lastError || new Error('Unable to connect to MSSQL group provider');
    }
    await this._ensureSchema();
    return this._pool;
  }

  async _ensureSchema() {
    const pool = await this._getPool();
    const query = `
IF OBJECT_ID('${this.tableName}', 'U') IS NULL
BEGIN
  CREATE TABLE ${this.tableName} (
    groupId NVARCHAR(128) NOT NULL PRIMARY KEY,
    label NVARCHAR(256) NOT NULL,
    description NVARCHAR(MAX) NULL,
    privileges NVARCHAR(MAX) NOT NULL,
    createdAt DATETIME2 NOT NULL,
    updatedAt DATETIME2 NOT NULL,
    deletedAt DATETIME2 NULL,
    deletedBy NVARCHAR(128) NULL
  )
END
`;
    await pool.request().query(query);
  }

  _mapRow(row) {
    return normalizeGroup({
      groupId: row.groupId,
      label: row.label,
      description: row.description,
      privileges: (() => {
        try {
          const parsed = JSON.parse(row.privileges || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      deletedBy: row.deletedBy
    });
  }

  async listGroups({ includeDeleted = false } = {}) {
    const pool = await this._getPool();
    const filter = includeDeleted ? '' : 'WHERE deletedAt IS NULL';
    const rs = await pool.request().query(`SELECT * FROM ${this.tableName} ${filter} ORDER BY groupId ASC`);
    return (rs.recordset || []).map(row => this._mapRow(row));
  }

  async getGroupById(groupId) {
    const id = String(groupId || '').trim();
    if (!id) return null;
    const pool = await this._getPool();
    const rs = await pool.request().input('groupId', this._sql.NVarChar(128), id).query(`SELECT TOP 1 * FROM ${this.tableName} WHERE groupId = @groupId`);
    const row = rs.recordset?.[0];
    return row ? this._mapRow(row) : null;
  }

  async createGroup(input) {
    const id = String(input?.groupId || '').trim();
    if (!id) throw new Error('groupId is required');

    const existing = await this.getGroupById(id);
    if (existing && !existing.deletedAt) throw new Error('Group already exists');

    const now = new Date().toISOString();
    const next = normalizeGroup({
      groupId: id,
      label: input?.label || id,
      description: input?.description || '',
      privileges: input?.privileges || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null
    });

    const pool = await this._getPool();
    await pool.request()
      .input('groupId', this._sql.NVarChar(128), next.groupId)
      .input('label', this._sql.NVarChar(256), next.label)
      .input('description', this._sql.NVarChar(this._sql.MAX), next.description)
      .input('privileges', this._sql.NVarChar(this._sql.MAX), JSON.stringify(next.privileges))
      .input('createdAt', this._sql.DateTime2, new Date(next.createdAt))
      .input('updatedAt', this._sql.DateTime2, new Date(next.updatedAt))
      .query(`
MERGE ${this.tableName} AS t
USING (SELECT @groupId AS groupId) AS s
ON t.groupId = s.groupId
WHEN MATCHED THEN
  UPDATE SET label=@label, description=@description, privileges=@privileges, updatedAt=@updatedAt, deletedAt=NULL, deletedBy=NULL
WHEN NOT MATCHED THEN
  INSERT (groupId,label,description,privileges,createdAt,updatedAt,deletedAt,deletedBy)
  VALUES (@groupId,@label,@description,@privileges,@createdAt,@updatedAt,NULL,NULL);
`);

    return next;
  }

  async updateGroup(groupId, updates) {
    const existing = await this.getGroupById(groupId);
    if (!existing) throw new Error('Group not found');
    if (existing.deletedAt) throw new Error('Cannot modify a soft-deleted group');

    const next = normalizeGroup({
      ...existing,
      label: Object.prototype.hasOwnProperty.call(updates || {}, 'label') ? updates.label : existing.label,
      description: Object.prototype.hasOwnProperty.call(updates || {}, 'description') ? updates.description : existing.description,
      privileges: Object.prototype.hasOwnProperty.call(updates || {}, 'privileges') ? updates.privileges : existing.privileges,
      updatedAt: new Date().toISOString()
    });

    const pool = await this._getPool();
    await pool.request()
      .input('groupId', this._sql.NVarChar(128), next.groupId)
      .input('label', this._sql.NVarChar(256), next.label)
      .input('description', this._sql.NVarChar(this._sql.MAX), next.description)
      .input('privileges', this._sql.NVarChar(this._sql.MAX), JSON.stringify(next.privileges))
      .input('updatedAt', this._sql.DateTime2, new Date(next.updatedAt))
      .query(`UPDATE ${this.tableName} SET label=@label, description=@description, privileges=@privileges, updatedAt=@updatedAt WHERE groupId=@groupId`);

    return next;
  }

  async softDeleteGroup(groupId, { deletedBy = 'system-admin' } = {}) {
    const existing = await this.getGroupById(groupId);
    if (!existing) throw new Error('Group not found');
    if (existing.deletedAt) return existing;

    const next = normalizeGroup({
      ...existing,
      deletedAt: new Date().toISOString(),
      deletedBy,
      updatedAt: new Date().toISOString()
    });

    const pool = await this._getPool();
    await pool.request()
      .input('groupId', this._sql.NVarChar(128), next.groupId)
      .input('deletedAt', this._sql.DateTime2, new Date(next.deletedAt))
      .input('deletedBy', this._sql.NVarChar(128), next.deletedBy)
      .input('updatedAt', this._sql.DateTime2, new Date(next.updatedAt))
      .query(`UPDATE ${this.tableName} SET deletedAt=@deletedAt, deletedBy=@deletedBy, updatedAt=@updatedAt WHERE groupId=@groupId`);

    return next;
  }
}

class UnsupportedGroupProvider {
  constructor({ providerName }) {
    this.providerName = providerName;
  }

  _raise() {
    throw new Error(`Group provider '${this.providerName}' is not implemented yet. Configure GROUP_PROVIDER=file or GROUP_PROVIDER=mssql for now.`);
  }

  async listGroups() { this._raise(); }
  async getGroupById() { this._raise(); }
  async createGroup() { this._raise(); }
  async updateGroup() { this._raise(); }
  async softDeleteGroup() { this._raise(); }
}

export function createGroupProvider({ provider = 'file', filePath = './data/user-groups.json', mssql = {} } = {}) {
  const chosen = String(provider || 'file').trim().toLowerCase();
  if (chosen === 'mssql') {
    return new MssqlGroupProvider({
      connectionString: String(mssql.connectionString || '').trim(),
      tableName: String(mssql.tableName || 'UserGroups').trim() || 'UserGroups'
    });
  }

  if (chosen === 'oracle' || chosen === 'azure-storage' || chosen === 'excel') {
    return new UnsupportedGroupProvider({ providerName: chosen });
  }

  return new FileGroupProvider({ filePath });
}
