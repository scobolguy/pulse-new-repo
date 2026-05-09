// QueueManagerPersistence.mjs
// Handles persistence for QueueManager (messages and config)
import fs from 'fs';

export class QueueManagerPersistence {
  constructor(persistPath = './queue_data.json', configPath = './queue_config.json') {
    this.persistPath = persistPath;
    this.configPath = configPath;
  }

  saveQueues(queues) {
    fs.writeFileSync(this.persistPath, JSON.stringify(queues, null, 2));
  }

  loadQueues() {
    if (fs.existsSync(this.persistPath)) {
      return JSON.parse(fs.readFileSync(this.persistPath));
    }
    return {};
  }

  saveConfig(config) {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      return JSON.parse(fs.readFileSync(this.configPath));
    }
    return {};
  }
}
