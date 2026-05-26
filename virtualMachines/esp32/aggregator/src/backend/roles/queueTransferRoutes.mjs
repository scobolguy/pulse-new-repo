export function registerQueueTransferRoutes(app, deps) {
  const {
    requirePermission,
    queueManagerInstances
  } = deps;

  app.get('/api/queues/:managerId/export', requirePermission('queue.view'), (req, res) => {
    try {
      const { managerId } = req.params;
      const qm = queueManagerInstances.get(managerId);
      if (!qm) return res.status(404).json({ error: `Queue manager ${managerId} not found` });

      const queues = {};
      for (const [queueName, queueConfig] of Object.entries(qm.queueConfig || {})) {
        const messages = (qm.queues[queueName]?.messages || []).map(msg => ({
          messageId: msg.messageId || null,
          sourceService: msg.sourceService || null,
          message: msg.message,
          messageEnvelope: msg.messageEnvelope || null
        }));
        queues[queueName] = { config: queueConfig, messages };
      }

      const exportData = {
        exportVersion: 1,
        exportedAt: new Date().toISOString(),
        managerId,
        queues
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="qm-export-${managerId}-${Date.now()}.json"`);
      res.json(exportData);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/queues/:managerId/import', requirePermission('queue.configure'), (req, res) => {
    try {
      const { managerId } = req.params;
      const qm = queueManagerInstances.get(managerId);
      if (!qm) return res.status(404).json({ error: `Queue manager ${managerId} not found` });

      const { queues, overwrite = false } = req.body || {};
      if (!queues || typeof queues !== 'object') {
        return res.status(400).json({ error: 'queues object is required' });
      }

      const results = { created: [], skipped: [], messagesImported: 0 };

      for (const [queueName, entry] of Object.entries(queues)) {
        const config = entry?.config || {};
        const messages = Array.isArray(entry?.messages) ? entry.messages : [];

        if (!qm.queueConfig[queueName]) {
          qm.createQueue(queueName, { ...config, name: queueName });
          results.created.push(queueName);
        } else if (overwrite) {
          qm.updateQueueConfig(queueName, config);
          results.created.push(queueName);
        } else {
          results.skipped.push(queueName);
        }

        for (const msg of messages) {
          try {
            qm.enqueueReplicated(
              queueName,
              msg.message,
              msg.sourceService || null,
              msg.messageId || null,
              msg.messageEnvelope || null
            );
            results.messagesImported++;
          } catch {
            // Skip individual bad messages.
          }
        }
      }

      res.json({ status: 'imported', managerId, ...results });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/queues/:managerId/:queueName/export', requirePermission('queue.view'), (req, res) => {
    try {
      const { managerId, queueName } = req.params;
      const qm = queueManagerInstances.get(managerId);
      if (!qm) return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      if (!qm.queueConfig[queueName]) return res.status(404).json({ error: `Queue ${queueName} not found` });

      const config = qm.queueConfig[queueName];
      const messages = (qm.queues[queueName]?.messages || []).map(msg => ({
        messageId: msg.messageId || null,
        sourceService: msg.sourceService || null,
        message: msg.message,
        messageEnvelope: msg.messageEnvelope || null
      }));

      const exportData = {
        exportVersion: 1,
        exportedAt: new Date().toISOString(),
        managerId,
        queueName,
        config,
        messages
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="queue-export-${queueName}-${Date.now()}.json"`);
      res.json(exportData);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/queues/:managerId/:queueName/import', requirePermission('queue.configure'), (req, res) => {
    try {
      const { managerId, queueName } = req.params;
      const qm = queueManagerInstances.get(managerId);
      if (!qm) return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      if (!qm.queueConfig[queueName]) return res.status(404).json({ error: `Queue ${queueName} not found` });

      const { messages = [], updateConfig = false, config = {} } = req.body || {};
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages must be an array' });
      }

      const results = { messagesImported: 0, errors: [] };

      if (updateConfig && Object.keys(config).length > 0) {
        qm.updateQueueConfig(queueName, config);
      }

      for (const msg of messages) {
        try {
          qm.enqueueReplicated(
            queueName,
            msg.message,
            msg.sourceService || null,
            msg.messageId || null,
            msg.messageEnvelope || null
          );
          results.messagesImported++;
        } catch (e) {
          results.errors.push({ messageId: msg.messageId, error: e.message });
        }
      }

      res.json({ status: 'imported', managerId, queueName, ...results });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/queues/:managerId/:queueName/messages/:messageId/export', requirePermission('queue.view'), (req, res) => {
    try {
      const { managerId, queueName, messageId } = req.params;
      const qm = queueManagerInstances.get(managerId);
      if (!qm) return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      if (!qm.queues[queueName]) return res.status(404).json({ error: `Queue ${queueName} not found` });

      const messages = qm.queues[queueName].messages || [];
      const msg = messages.find(m => (m.messageId || '').toString() === messageId);
      if (!msg) return res.status(404).json({ error: `Message ${messageId} not found` });

      const exportData = {
        exportVersion: 1,
        exportedAt: new Date().toISOString(),
        managerId,
        queueName,
        messageId,
        message: {
          messageId: msg.messageId || null,
          sourceService: msg.sourceService || null,
          message: msg.message,
          messageEnvelope: msg.messageEnvelope || null
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="message-export-${queueName}-${messageId}-${Date.now()}.json"`);
      res.json(exportData);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/queues/:managerId/:queueName/messages/:messageId', requirePermission('queue.configure'), (req, res) => {
    try {
      const { managerId, queueName, messageId } = req.params;
      const qm = queueManagerInstances.get(managerId);
      if (!qm) return res.status(404).json({ error: `Queue manager ${managerId} not found` });
      if (!qm.queues[queueName]) return res.status(404).json({ error: `Queue ${queueName} not found` });

      const messages = qm.queues[queueName].messages || [];
      const idx = messages.findIndex(m => (m.messageId || '').toString() === messageId);
      if (idx === -1) return res.status(404).json({ error: `Message ${messageId} not found` });

      messages.splice(idx, 1);
      res.json({ status: 'deleted', managerId, queueName, messageId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
