// QueueManagerPersistence.mjs
// Handles persistence for QueueManager (configs and operations)
import fs from 'fs';
import path from 'path';

export class QueueManagerPersistence {
  constructor(queueManagerName = 'default', basePath = './data') {
    this.queueManagerName = queueManagerName;
    this.basePath = path.join(basePath, queueManagerName);
    this.configPath = path.join(this.basePath, 'config.json');
    this.operationsPath = path.join(this.basePath, 'operations.jsonl');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  // Save queue manager configuration to disk
  saveConfig(queueConfig, configVersion) {
    const data = { queueConfig, configVersion, timestamp: Date.now() };
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
  }

  // Load queue manager configuration from disk
  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.error(`Error loading config for ${this.queueManagerName}:`, e.message);
        return null;
      }
    }
    return null;
  }

  // Append an operation to the operation log
  appendOperation(operation) {
    try {
      const line = JSON.stringify(operation) + '\n';
      fs.appendFileSync(this.operationsPath, line);
    } catch (e) {
      console.error(`Error appending operation for ${this.queueManagerName}:`, e.message);
    }
  }

  // Load all operations from disk
  loadOperations() {
    const operations = [];
    if (fs.existsSync(this.operationsPath)) {
      try {
        const content = fs.readFileSync(this.operationsPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            operations.push(JSON.parse(line));
          } catch (e) {
            console.error(`Error parsing operation line: ${e.message}`);
          }
        }
      } catch (e) {
        console.error(`Error loading operations for ${this.queueManagerName}:`, e.message);
      }
    }
    return operations;
  }

  // Load operations since a specific version
  loadOperationsSince(version) {
    return this.loadOperations().filter(op => op.version && op.version > version);
  }

  // Clear all data (for cleanup or reset)
  clearAll() {
    try {
      if (fs.existsSync(this.configPath)) fs.unlinkSync(this.configPath);
      if (fs.existsSync(this.operationsPath)) fs.unlinkSync(this.operationsPath);
    } catch (e) {
      console.error(`Error clearing data for ${this.queueManagerName}:`, e.message);
    }
  }

  getFileAttributes(filePath) {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        sizeBytes: 0,
        mtimeMs: null,
        mtimeIso: null,
      };
    }

    const stat = fs.statSync(filePath);
    return {
      exists: true,
      sizeBytes: Number(stat.size || 0),
      mtimeMs: Number(stat.mtimeMs || 0),
      mtimeIso: stat.mtime ? stat.mtime.toISOString() : null,
    };
  }

  getPersistenceStatus() {
    return {
      queueManagerName: this.queueManagerName,
      basePath: this.basePath,
      config: this.getFileAttributes(this.configPath),
      operations: this.getFileAttributes(this.operationsPath),
      checkedAt: new Date().toISOString(),
    };
  }
}
