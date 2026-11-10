import fs from 'node:fs';
import path from 'node:path';

// Single local authority; never automatically steal an abandoned writer lock.
export class DurableRecordJournal {
  constructor(filePath, { recordKey, label, maxRecordBytes, maxJournalBytes }) {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath))
      throw new Error(`An absolute ${label.toLowerCase()} path is required`);
    this.label = label;
    this.recordKey = recordKey;
    this.maxRecordBytes = maxRecordBytes;
    this.maxJournalBytes = maxJournalBytes;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.filePath = path.join(fs.realpathSync(path.dirname(filePath)), path.basename(filePath));
    this.lockPath = `${this.filePath}.lock`;
    this.lock = fs.openSync(this.lockPath, 'wx');
    try {
      this.fd = fs.openSync(this.filePath, fs.constants.O_RDWR | fs.constants.O_CREAT);
      const size = fs.fstatSync(this.fd).size;
      if (size > maxJournalBytes) throw new Error(`${label} exceeds capacity`);
      const bytes = Buffer.alloc(size);
      let offset = 0;
      while (offset < size) {
        const count = fs.readSync(this.fd, bytes, offset, size - offset, offset);
        if (!count) throw new Error(`${label} read was incomplete`);
        offset += count;
      }
      const lastNewline = bytes.lastIndexOf(10);
      const committed = bytes.subarray(0, lastNewline + 1).toString('utf8');
      if (!Buffer.from(committed).equals(bytes.subarray(0, lastNewline + 1)))
        throw new Error(`${label} contains invalid UTF-8`);
      this.records = committed ? committed.trimEnd().split('\n').map(line => {
        if (Buffer.byteLength(line) > maxRecordBytes) throw new Error(`${label} record exceeds capacity`);
        const record = JSON.parse(line);
        if (record.version !== 1 || !record[recordKey]) throw new Error(`Invalid ${label.toLowerCase()} record`);
        return record[recordKey];
      }) : [];
      // An incomplete final append is not an acknowledged commit.
      fs.ftruncateSync(this.fd, lastNewline + 1);
      fs.fsyncSync(this.fd);
      this.bytes = lastNewline + 1;
    } catch (error) {
      this.close();
      throw error;
    }
  }

  requireAvailable() {
    if (this.fd === undefined || this.poisoned) throw new Error(`${this.label} is unavailable`);
  }

  append(record) {
    this.requireAvailable();
    const data = Buffer.from(`${JSON.stringify({ version: 1, [this.recordKey]: record })}\n`);
    if (data.length > this.maxRecordBytes || this.bytes + data.length > this.maxJournalBytes)
      throw new Error(`${this.label} exceeds capacity`);
    try {
      let offset = 0;
      while (offset < data.length) {
        const count = fs.writeSync(this.fd, data, offset, data.length - offset, this.bytes + offset);
        if (!count) throw new Error(`${this.label} write was incomplete`);
        offset += count;
      }
      fs.fsyncSync(this.fd);
      this.bytes += data.length;
    } catch (error) {
      // Failed sync is an uncertain outcome. Reopen/reconcile before any reuse.
      this.poisoned = true;
      throw error;
    }
  }

  close() {
    try {
      if (this.fd !== undefined) fs.closeSync(this.fd);
    } finally {
      this.fd = undefined;
      if (this.lock !== undefined) {
        fs.closeSync(this.lock);
        this.lock = undefined;
        fs.unlinkSync(this.lockPath);
      }
    }
  }
}
