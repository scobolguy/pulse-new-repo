import fs from 'fs';

function normalizeClassId(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeMonitorClass(raw) {
  const now = new Date().toISOString();
  return {
    classId: normalizeClassId(raw?.classId),
    label: String(raw?.label || raw?.classId || '').trim(),
    description: String(raw?.description || '').trim(),
    enabled: raw?.enabled !== false,
    sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : 100,
    createdAt: String(raw?.createdAt || now),
    updatedAt: String(raw?.updatedAt || now),
    deletedAt: raw?.deletedAt ? String(raw.deletedAt) : null,
    deletedBy: raw?.deletedBy ? String(raw.deletedBy) : null
  };
}

function createDefaultClasses() {
  const now = new Date().toISOString();
  return [
    {
      classId: 'transaction-flows',
      label: 'Transaction Flows',
      description: 'Monitor transaction flow health and throughput.',
      enabled: true,
      sortOrder: 10,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null
    },
    {
      classId: 'gateways',
      label: 'Gateways',
      description: 'Monitor gateway status and connectivity.',
      enabled: true,
      sortOrder: 20,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null
    },
    {
      classId: 'servers',
      label: 'Servers',
      description: 'Monitor server and queue manager runtime.',
      enabled: true,
      sortOrder: 30,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null
    }
  ];
}

class FileMonitorClassProvider {
  constructor({ filePath }) {
    this.filePath = filePath;
  }

  _readStore() {
    if (!fs.existsSync(this.filePath)) {
      const initial = {
        version: 1,
        updatedAt: new Date().toISOString(),
        classes: createDefaultClasses()
      };
      fs.writeFileSync(this.filePath, `${JSON.stringify(initial, null, 2)}\n`, 'utf-8');
      return initial;
    }

    const rawText = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = rawText.trim() ? JSON.parse(rawText) : { version: 1, updatedAt: new Date().toISOString(), classes: [] };
    const classes = Array.isArray(parsed.classes)
      ? parsed.classes.map(normalizeMonitorClass).filter(item => item.classId)
      : [];

    if (classes.length === 0) {
      return {
        version: Number(parsed.version || 1),
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
        classes: createDefaultClasses().map(normalizeMonitorClass)
      };
    }

    return {
      version: Number(parsed.version || 1),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      classes
    };
  }

  _writeStore(store) {
    const next = {
      version: Number(store?.version || 1),
      updatedAt: new Date().toISOString(),
      classes: Array.isArray(store?.classes) ? store.classes.map(normalizeMonitorClass) : []
    };
    fs.writeFileSync(this.filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
  }

  async listClasses({ includeDisabled = false, includeDeleted = false } = {}) {
    const store = this._readStore();
    return store.classes
      .filter(item => includeDeleted || !item.deletedAt)
      .filter(item => includeDisabled || item.enabled)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  async getClassById(classId) {
    const id = normalizeClassId(classId);
    if (!id) return null;
    const store = this._readStore();
    return store.classes.find(item => item.classId === id) || null;
  }

  async createClass(input) {
    const id = normalizeClassId(input?.classId);
    if (!id) throw new Error('classId is required');

    const store = this._readStore();
    const existing = store.classes.find(item => item.classId === id);
    if (existing && !existing.deletedAt) {
      throw new Error('Monitor class already exists');
    }

    const now = new Date().toISOString();
    const created = normalizeMonitorClass({
      classId: id,
      label: input?.label || id,
      description: input?.description || '',
      enabled: input?.enabled !== false,
      sortOrder: input?.sortOrder,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null
    });

    if (existing) {
      store.classes = store.classes.map(item => (item.classId === id ? created : item));
    } else {
      store.classes.push(created);
    }

    this._writeStore(store);
    return created;
  }

  async updateClass(classId, updates = {}) {
    const id = normalizeClassId(classId);
    if (!id) throw new Error('classId is required');

    const store = this._readStore();
    const current = store.classes.find(item => item.classId === id);
    if (!current) throw new Error('Monitor class not found');
    if (current.deletedAt) throw new Error('Cannot modify a deleted monitor class');

    const merged = normalizeMonitorClass({
      ...current,
      label: Object.prototype.hasOwnProperty.call(updates, 'label') ? updates.label : current.label,
      description: Object.prototype.hasOwnProperty.call(updates, 'description') ? updates.description : current.description,
      enabled: Object.prototype.hasOwnProperty.call(updates, 'enabled') ? updates.enabled : current.enabled,
      sortOrder: Object.prototype.hasOwnProperty.call(updates, 'sortOrder') ? updates.sortOrder : current.sortOrder,
      updatedAt: new Date().toISOString()
    });

    store.classes = store.classes.map(item => (item.classId === id ? merged : item));
    this._writeStore(store);
    return merged;
  }

  async softDeleteClass(classId, { deletedBy = 'system-admin' } = {}) {
    const id = normalizeClassId(classId);
    if (!id) throw new Error('classId is required');

    const store = this._readStore();
    const current = store.classes.find(item => item.classId === id);
    if (!current) throw new Error('Monitor class not found');
    if (current.deletedAt) return current;

    const updated = normalizeMonitorClass({
      ...current,
      deletedAt: new Date().toISOString(),
      deletedBy: String(deletedBy || 'system-admin').trim() || 'system-admin',
      updatedAt: new Date().toISOString()
    });

    store.classes = store.classes.map(item => (item.classId === id ? updated : item));
    this._writeStore(store);
    return updated;
  }
}

class MssqlMonitorClassProvider {
  constructor() {
    throw new Error('mssql monitor class provider not implemented yet; use MONITOR_CLASS_PROVIDER=file for now');
  }
}

export function createMonitorClassProvider({ provider = 'file', filePath = './data/monitor-classes.json' } = {}) {
  const chosen = String(provider || 'file').trim().toLowerCase();
  if (chosen === 'mssql') {
    return new MssqlMonitorClassProvider();
  }
  return new FileMonitorClassProvider({ filePath });
}
