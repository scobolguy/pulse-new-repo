/**
 * MetricsCollector - Real-time system metrics collection for worker performance analysis
 * Tracks: queue depths, processing latency, system resources, worker health
 */

import fs from 'fs';
import os from 'os';

export class MetricsCollector {
  constructor(options = {}) {
    this.options = {
      collectionIntervalMs: options.collectionIntervalMs || 10000, // 10 seconds
      metricsFilePath: options.metricsFilePath || './data/worker-metrics.jsonl',
      performanceFilePath: options.performanceFilePath || './data/worker-performance.jsonl',
      maxFileSizeMB: options.maxFileSizeMB || 100,
      retentionDays: options.retentionDays || 7,
      ...options
    };
    
    this.metrics = {
      queueDepths: new Map(),           // queueName -> { total, current, max, min, avg }
      processingLatencies: new Map(),   // queueName -> { values[], avg, p50, p95, p99 }
      systemResources: [],              // Array of resource snapshots
      workerHealth: new Map(),          // workerId -> { processed, failed, errorRate }
      startTime: Date.now(),
      collectionCount: 0
    };
    
    this.collectionTimer = null;
    this.latencyTracker = new Map(); // messageId -> { enqueuedAt, dequeuedAt, completedAt }
  }

  /**
   * Start collecting metrics periodically
   */
  start() {
    console.log('[METRICS] Starting metrics collection...');
    this.collectionTimer = setInterval(() => this.collect(), this.options.collectionIntervalMs);
    // Collect immediately on startup
    this.collect();
  }

  /**
   * Stop collecting metrics
   */
  stop() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
      console.log('[METRICS] Stopped metrics collection');
    }
  }

  /**
   * Record a message enqueue event
   */
  recordEnqueue(messageId, queueName) {
    this.latencyTracker.set(messageId, {
      enqueuedAt: Date.now(),
      queueName
    });
  }

  /**
   * Record a message dequeue event
   */
  recordDequeue(messageId) {
    const tracker = this.latencyTracker.get(messageId);
    if (tracker) {
      tracker.dequeuedAt = Date.now();
    }
  }

  /**
   * Record a message processing completion
   */
  recordCompletion(messageId, success = true) {
    const tracker = this.latencyTracker.get(messageId);
    if (tracker) {
      tracker.completedAt = Date.now();
      const latency = tracker.completedAt - tracker.enqueuedAt;
      
      // Update latency tracking
      const queueName = tracker.queueName;
      if (!this.metrics.processingLatencies.has(queueName)) {
        this.metrics.processingLatencies.set(queueName, {
          values: [],
          samples: 0,
          sum: 0,
          min: Infinity,
          max: 0
        });
      }
      
      const latencyData = this.metrics.processingLatencies.get(queueName);
      latencyData.values.push(latency);
      latencyData.samples++;
      latencyData.sum += latency;
      latencyData.min = Math.min(latencyData.min, latency);
      latencyData.max = Math.max(latencyData.max, latency);
      
      // Keep only last 1000 samples per queue to avoid memory bloat
      if (latencyData.values.length > 1000) {
        latencyData.values.shift();
      }
      
      // Clean up old trackers (keep last 10000)
      if (this.latencyTracker.size > 10000) {
        const entries = Array.from(this.latencyTracker.entries());
        entries.slice(0, 5000).forEach(([key]) => this.latencyTracker.delete(key));
      }
    }
  }

  /**
   * Record queue depth
   */
  recordQueueDepth(queueName, depth) {
    if (!this.metrics.queueDepths.has(queueName)) {
      this.metrics.queueDepths.set(queueName, {
        samples: [],
        current: 0,
        max: 0,
        min: Infinity,
        sum: 0,
        count: 0
      });
    }
    
    const data = this.metrics.queueDepths.get(queueName);
    data.current = depth;
    data.samples.push({ timestamp: Date.now(), depth });
    data.max = Math.max(data.max, depth);
    data.min = Math.min(data.min, depth);
    data.sum += depth;
    data.count++;
    
    // Keep last 1000 samples
    if (data.samples.length > 1000) {
      data.samples.shift();
    }
  }

  /**
   * Record worker health metrics
   */
  recordWorkerActivity(workerId, success = true) {
    if (!this.metrics.workerHealth.has(workerId)) {
      this.metrics.workerHealth.set(workerId, {
        processed: 0,
        failed: 0,
        lastActive: Date.now(),
        startTime: Date.now()
      });
    }
    
    const health = this.metrics.workerHealth.get(workerId);
    if (success) {
      health.processed++;
    } else {
      health.failed++;
    }
    health.lastActive = Date.now();
  }

  /**
   * Collect system resource snapshot
   */
  collectSystemResources() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const cpuUsagePercent = this.calculateCpuUsage(cpus);
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    const snapshot = {
      timestamp: Date.now(),
      cpu: {
        count: cpus.length,
        usagePercent: cpuUsagePercent,
        model: cpus[0]?.model
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: memoryUsagePercent
      },
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
    
    this.metrics.systemResources.push(snapshot);
    
    // Keep last 1000 snapshots (~10000 seconds = ~2.8 hours)
    if (this.metrics.systemResources.length > 1000) {
      this.metrics.systemResources.shift();
    }
    
    return snapshot;
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCpuUsage(cpus) {
    if (!this.lastCpuMeasure) {
      this.lastCpuMeasure = this.getCpuMeasure(cpus);
      return 0;
    }
    
    const current = this.getCpuMeasure(cpus);
    const diff = {
      idle: current.idle - this.lastCpuMeasure.idle,
      total: current.total - this.lastCpuMeasure.total
    };
    
    const usage = (1 - diff.idle / diff.total) * 100;
    this.lastCpuMeasure = current;
    return Math.round(usage * 100) / 100;
  }

  /**
   * Get CPU measure for calculation
   */
  getCpuMeasure(cpus) {
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    }
    
    return { idle, total };
  }

  /**
   * Perform collection cycle
   */
  collect() {
    this.metrics.collectionCount++;
    
    // Collect system resources
    const resources = this.collectSystemResources();
    
    // Calculate statistics for latencies
    const latencyStats = {};
    for (const [queueName, data] of this.metrics.processingLatencies) {
      if (data.samples > 0) {
        const sorted = [...data.values].sort((a, b) => a - b);
        latencyStats[queueName] = {
          samples: data.samples,
          avg: Math.round(data.sum / data.samples),
          min: data.min,
          max: data.max,
          p50: this.percentile(sorted, 50),
          p95: this.percentile(sorted, 95),
          p99: this.percentile(sorted, 99)
        };
      }
    }
    
    // Prepare metric snapshot for storage
    const snapshot = {
      timestamp: Date.now(),
      collection: this.metrics.collectionCount,
      uptime: Date.now() - this.metrics.startTime,
      systemResources: resources,
      queueDepths: Object.fromEntries(
        Array.from(this.metrics.queueDepths.entries()).map(([name, data]) => [
          name,
          {
            current: data.current,
            max: data.max,
            min: data.min,
            avg: data.count > 0 ? Math.round(data.sum / data.count) : 0
          }
        ])
      ),
      processingLatencies: latencyStats,
      workerHealth: Object.fromEntries(
        Array.from(this.metrics.workerHealth.entries()).map(([id, data]) => [
          id,
          {
            processed: data.processed,
            failed: data.failed,
            errorRate: data.processed + data.failed > 0 
              ? Math.round((data.failed / (data.processed + data.failed)) * 10000) / 100
              : 0,
            uptime: Date.now() - data.startTime
          }
        ])
      )
    };
    
    // Write to metrics file
    this.writeMetricsSnapshot(snapshot);
    
    return snapshot;
  }

  /**
   * Calculate percentile
   */
  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Write metrics snapshot to JSONL file
   */
  writeMetricsSnapshot(snapshot) {
    try {
      const line = JSON.stringify(snapshot) + '\n';
      fs.appendFileSync(this.options.metricsFilePath, line, 'utf-8');
      
      // Check file size and rotate if needed
      this.checkAndRotateFile(this.options.metricsFilePath);
    } catch (e) {
      console.warn(`[METRICS] Failed to write snapshot: ${e.message}`);
    }
  }

  /**
   * Write performance event to file
   */
  writePerformanceEvent(event) {
    try {
      const line = JSON.stringify({
        timestamp: Date.now(),
        ...event
      }) + '\n';
      fs.appendFileSync(this.options.performanceFilePath, line, 'utf-8');
      
      // Check file size and rotate if needed
      this.checkAndRotateFile(this.options.performanceFilePath);
    } catch (e) {
      console.warn(`[METRICS] Failed to write performance event: ${e.message}`);
    }
  }

  /**
   * Check and rotate log files if size exceeded
   */
  checkAndRotateFile(filePath) {
    try {
      const maxBytes = this.options.maxFileSizeMB * 1024 * 1024;
      const stats = fs.statSync(filePath);
      
      if (stats.size > maxBytes) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.${timestamp}`;
        fs.renameSync(filePath, backupPath);
        console.log(`[METRICS] Rotated ${filePath} to ${backupPath}`);
        
        // Clean up old rotated files (older than retention period)
        this.cleanupOldFiles(filePath);
      }
    } catch (e) {
      console.warn(`[METRICS] File rotation check failed: ${e.message}`);
    }
  }

  /**
   * Clean up old rotated files based on retention policy
   */
  cleanupOldFiles(filePath) {
    try {
      const dir = require('path').dirname(filePath);
      const basename = require('path').basename(filePath);
      const files = fs.readdirSync(dir);
      const retentionMs = this.options.retentionDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      files.forEach(file => {
        if (file.startsWith(basename) && file !== basename) {
          const fullPath = require('path').join(dir, file);
          try {
            const stats = fs.statSync(fullPath);
            if (now - stats.mtime.getTime() > retentionMs) {
              fs.unlinkSync(fullPath);
              console.log(`[METRICS] Cleaned up old file: ${file}`);
            }
          } catch (e) {
            // Ignore errors on individual file cleanup
          }
        }
      });
    } catch (e) {
      // Silently ignore cleanup errors
    }
  }

  /**
   * Get current metrics snapshot
   */
  getCurrentMetrics() {
    const latencyStats = {};
    for (const [queueName, data] of this.metrics.processingLatencies) {
      if (data.samples > 0) {
        const sorted = [...data.values].sort((a, b) => a - b);
        latencyStats[queueName] = {
          samples: data.samples,
          avg: Math.round(data.sum / data.samples),
          min: data.min,
          max: data.max,
          p50: this.percentile(sorted, 50),
          p95: this.percentile(sorted, 95),
          p99: this.percentile(sorted, 99)
        };
      }
    }
    
    return {
      uptime: Date.now() - this.metrics.startTime,
      collectionCount: this.metrics.collectionCount,
      queueDepths: Object.fromEntries(
        Array.from(this.metrics.queueDepths.entries()).map(([name, data]) => [
          name,
          {
            current: data.current,
            max: data.max,
            min: data.min,
            avg: data.count > 0 ? Math.round(data.sum / data.count) : 0,
            samples: data.count
          }
        ])
      ),
      processingLatencies: latencyStats,
      workerHealth: Object.fromEntries(
        Array.from(this.metrics.workerHealth.entries()).map(([id, data]) => [
          id,
          {
            processed: data.processed,
            failed: data.failed,
            errorRate: (data.processed + data.failed > 0 
              ? Math.round((data.failed / (data.processed + data.failed)) * 10000) / 100
              : 0) + '%'
          }
        ])
      ),
      systemResources: this.metrics.systemResources.length > 0 
        ? this.metrics.systemResources[this.metrics.systemResources.length - 1]
        : null
    };
  }

  /**
   * Get metrics history (last N collection cycles)
   */
  getMetricsHistory(limit = 100) {
    return this.metrics.systemResources.slice(-limit);
  }
}

export default MetricsCollector;
